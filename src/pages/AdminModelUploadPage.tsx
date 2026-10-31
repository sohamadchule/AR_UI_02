import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Eye, LogOut, Plus, Scissors, Sparkles, Trash2, Undo2, Upload } from 'lucide-react';
import {
  AdminApiError,
  createProduct,
  fetchAdminModel,
  fetchCategories,
  splitModel,
  uploadModel,
  viewPath,
  type Category,
  type CreatedProduct,
  type ModelMaterial,
  type UploadedModel,
} from '@/lib/api';
import { SAME_COLOUR_DE, achievedHex, deltaE, isAchievable, isHex, nameColour, suggestColours, type Recolor, type Tint } from '@/lib/color';
import { UNITS, formatLength, fromMm, type Unit } from '@/lib/units';
import { suggestCategory } from '@/lib/category';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { AdminSignIn, useAdminToken } from '@/features/admin/AdminSignIn';
import ModelViewer from '@/features/experience/ModelViewer';

const MAX_MB = 50;
const NEW_CATEGORY = '__new';
const FABRICS = ['Velvet', 'Linen', 'Cotton', 'Leather', 'Faux leather', 'Bouclé', 'Wool', 'Chenille'];
const AXES = ['width', 'height', 'depth'] as const;
type Axis = (typeof AXES)[number];
type Size = Record<Axis, number>;

/** Largest size a product may have, in mm (also enforced by the server). */
const MAX_SIZE_MM = 100_000;
/** A file whose largest side (in mm) is outside this range was exported at the wrong scale. */
const PLAUSIBLE_MM = { min: 50, max: 20_000 };
/** Wrongly scaled models are brought to a largest side within [500 mm, 5 m) by a power of ten. */
const TARGET_LARGEST_MM = 500;

const scaleSize = (s: Size, k: number): Size => ({ width: s.width * k, height: s.height * k, depth: s.depth * k });
const largest = (s: Size) => Math.max(s.width, s.height, s.depth);
const plausible = (s: Size) => largest(s) >= PLAUSIBLE_MM.min && largest(s) <= PLAUSIBLE_MM.max;
/**
 * 1 for a plausibly sized model; otherwise the power of ten that makes it furniture-sized.
 * Files exported at the wrong scale are off by such factors (cm, mm, or a tool's own units:
 * one desk here reported 687 km wide). The uploader then corrects one side and the rest follow.
 */
const guessScale = (s: Size) => (largest(s) <= 0 || plausible(s) ? 1 : 10 ** Math.ceil(Math.log10(TARGET_LARGEST_MM / largest(s))));
const metres = (mm: number) => (mm >= 1e6 ? `${Math.round(mm / 1e6).toLocaleString()} km` : `${Number((mm / 1000).toPrecision(3))} m`);
const describeSize = (s: Size) => `${metres(s.width)} × ${metres(s.height)} × ${metres(s.depth)}`;

interface ColourRow {
  key: string;
  name: string;
  /** Ignored for the original row, which always uses the detected colour. */
  hex: string;
  fabric: string;
  sku: string;
  original: boolean;
  /** The name was filled in automatically (not typed), so it follows the detected colour. */
  autoName?: boolean;
}

const inputCls =
  'w-full rounded-xl border border-line/15 bg-surface px-4 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none';
const labelCls = 'mb-1.5 block text-xs uppercase tracking-[0.12em] text-fg-muted';
let rowSeq = 0;
const newKey = () => `row-${++rowSeq}`;

/** A colour offered for an extra part (not the main one, whose colours are the catalogue options). */
interface PaletteRow {
  key: string;
  name: string;
  hex: string;
}
/** An extra part's colours: its own colour first (named automatically unless typed), then the added ones. */
interface Palette {
  originalName: string | null;
  rows: PaletteRow[];
}
const EMPTY_PALETTE: Palette = { originalName: null, rows: [] };
/** Material names that say nothing about the part ("lambert3SG", "Material 4"). */
const GENERIC_NAME = /^(material|lambert|phong|blinn|standard|mat|default)\b|^\W*$/i;
/** A part name for a material: "seat_cushion_02" → "Seat cushion"; generic names → `fallback`. */
function partNameOf(materialName: string, fallback: string) {
  // Exporters prefix and suffix numbers ("02___Default", "Box001"): they aren't part of the name.
  const words = partStem(materialName).replace(/[_\-.]+/g, ' ').replace(/^[\d\s]+/, '').trim();
  if (!words || GENERIC_NAME.test(words)) return fallback;
  return `${words[0].toUpperCase()}${words.slice(1).toLowerCase()}`.slice(0, 40);
}

/** "Cylinder007" → "Cylinder": parts exported from one tool usually share such a stem. */
const partStem = (name: string) => name.replace(/[\s._:-]*\d+$/, '').replace(/[\s._:-]+$/, '') || name;
const percent = (share: number | null) => (share === null ? '' : share < 0.01 ? 'under 1%' : `${Math.round(share * 100)}%`);

/** Parts of a material grouped by name stem: one-click picks like "Cylinder ×6". */
function stemGroups(parts: ModelMaterial['parts']) {
  const groups = new Map<string, number[]>();
  for (const part of parts) groups.set(partStem(part.name), [...(groups.get(partStem(part.name)) ?? []), part.node]);
  return [...groups.entries()]
    .filter(([, nodes]) => nodes.length > 1 && nodes.length < parts.length)
    .map(([stem, nodes]) => ({ stem, nodes }));
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line/10 bg-surface-raised p-6 md:p-8">
      <h2 className="flex items-baseline gap-3 text-lg font-light text-fg">
        <span className="text-xs text-fg-subtle">{String(step).padStart(2, '0')}</span>
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-fg-muted">{hint}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

const FieldError = ({ msg }: { msg?: string }) =>
  msg ? (
    <p role="alert" className="mt-1.5 text-xs text-red-500">
      {msg}
    </p>
  ) : null;

/**
 * Admin: upload a GLB and publish it as a product with colour options.
 *
 * The server stores the file and reports each material's colour. The uploader
 * ticks the recolourable part (upholstery is pre-ticked); its detected colour
 * becomes the "original" colour, and the suggestions leave out anything that
 * looks the same as it, as a colour already added, or as one the texture can't reach.
 */
export function AdminModelUploadPage() {
  const { token, signIn, signOut } = useAdminToken();
  const [authError, setAuthError] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [model, setModel] = useState<UploadedModel | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [tintSet, setTintSet] = useState<Set<number>>(new Set());
  /** Part name per ticked material (glTF index): materials sharing a name change colour together. */
  const [partOf, setPartOf] = useState<Record<number, string>>({});
  /** Colours for each extra part, keyed by the part's first material. */
  const [palettes, setPalettes] = useState<Record<number, Palette>>({});
  /** The colour chip open for editing in step 4, as "<part key or main>/<row key>". */
  const [editing, setEditing] = useState<string | null>(null);
  /** Palette row shown in the preview for each extra part, keyed like `palettes`; its own colour otherwise. */
  const [previewPicks, setPreviewPicks] = useState<Record<number, string>>({});
  /** Bumped when a part stops being recoloured: the preview reloads to show its authored colour again. */
  const [previewEpoch, setPreviewEpoch] = useState(0);
  /** Material glowing in the preview, so the uploader can see which part it is. */
  const [highlight, setHighlight] = useState<number | null>(null);

  // Split by part: which material's parts are being picked, the picks, and earlier versions for undo.
  const [splitFor, setSplitFor] = useState<number | null>(null);
  const [splitPick, setSplitPick] = useState<Set<number>>(new Set());
  const [splitName, setSplitName] = useState('');
  const [splitting, setSplitting] = useState(false);
  const [splitError, setSplitError] = useState('');
  const [history, setHistory] = useState<{ model: UploadedModel; previewUrl: string | null }[]>([]);
  /** Every preview URL made on this page; kept alive for undo and revoked when the page closes. */
  const urls = useRef<string[]>([]);
  const makeUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.push(url);
    return url;
  };

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  /** The uploader chose the category themselves, so the name-based suggestion stops overriding it. */
  const [categoryPicked, setCategoryPicked] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [status, setStatus] = useState<'active' | 'draft'>('active');

  const [unit, setUnit] = useState<Unit>('cm');
  /** File units → metres, chosen when the model's own size is implausible. */
  const [modelScale, setModelScale] = useState(1);
  /** Only what the uploader typed: the model's size is offered as a suggestion, never written in. */
  const [dims, setDims] = useState<Record<Axis, string>>({ width: '', height: '', depth: '' });
  /** The side typed last: the other sides are suggested from it and the model's shape. */
  const [anchorAxis, setAnchorAxis] = useState<Axis | null>(null);

  const [rows, setRows] = useState<ColourRow[]>([]);
  const [defaultKey, setDefaultKey] = useState('');
  const [previewKey, setPreviewKey] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedProduct | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Upload model · Admin';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const handleAuthFailure = useCallback(
    (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Request failed';
      if (msg === 'Invalid admin token') {
        signOut();
        setAuthError(msg);
        return true;
      }
      return false;
    },
    [signOut],
  );

  useEffect(() => {
    if (!token) return;
    fetchCategories(token).then(
      (list) => {
        setCategories(list);
        // No silent default: the suggestion below (or the uploader) fills it in.
        if (!list.length) setCategoryId(NEW_CATEGORY);
      },
      (e) => {
        if (!handleAuthFailure(e)) setFormError('Could not load categories.');
      },
    );
  }, [token, handleAuthFailure]);

  // The category the product name (or file name) points to; it fills the field until the uploader picks one.
  const suggestedCategory = useMemo(() => suggestCategory([name, file?.name ?? ''], categories), [name, file, categories]);
  useEffect(() => {
    if (!categoryPicked && categories.length) setCategoryId(suggestedCategory?.id ?? '');
  }, [suggestedCategory, categoryPicked, categories.length]);

  // Revoke the preview URLs when the page closes (earlier ones stay usable for undo until then).
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // ---- derived colour state -------------------------------------------------
  const selected = useMemo(() => model?.materials.filter((m) => tintSet.has(m.index)) ?? [], [model, tintSet]);
  /**
   * Ticked materials grouped into parts by name, biggest surface first. The first part is
   * the main one: its colours are the catalogue options; customers mix the others freely.
   */
  const parts = useMemo(() => {
    const groups = new Map<string, ModelMaterial[]>();
    for (const m of selected) {
      const name = (partOf[m.index] ?? m.name).trim().toLowerCase();
      groups.set(name, [...(groups.get(name) ?? []), m]);
    }
    return [...groups.values()].map((ms) => ({
      key: ms[0].index,
      name: (partOf[ms[0].index] ?? ms[0].name).trim(),
      materials: ms,
      baseHex: ms[0].hex,
      tint: { materials: ms.map(({ index, texAvg, base, sheen }) => ({ index, texAvg, base, sheen })) } as Tint,
    }));
  }, [selected, partOf]);
  type Part = (typeof parts)[number];
  const multiPart = parts.length > 1;
  const tint: Tint | null = parts[0]?.tint ?? null;
  const baseHex = parts[0]?.baseHex ?? null;
  const paletteOf = (part: Part) => palettes[part.key] ?? EMPTY_PALETTE;
  /** An extra part's colours as the customer will see them: its own first. */
  const partColours = (part: Part) => [
    { key: 'original', name: paletteOf(part).originalName ?? nameColour(part.baseHex), hex: part.baseHex },
    ...paletteOf(part).rows,
  ];
  const partPreviewHex = (part: Part) => partColours(part).find((c) => c.key === previewPicks[part.key])?.hex ?? part.baseHex;

  // The original colour's automatic name follows whichever part is ticked (until the uploader types one).
  useEffect(() => {
    setRows((current) =>
      current.map((r) => (r.original && r.autoName ? { ...r, name: baseHex ? nameColour(baseHex) : 'Standard' } : r)),
    );
  }, [baseHex]);
  const rowHex = (r: ColourRow) => (r.original ? baseHex : r.hex);
  const suggestions = useMemo(
    () => (tint && baseHex ? suggestColours(baseHex, tint, rows.filter((r) => !r.original).map((r) => r.hex)) : []),
    [tint, baseHex, rows],
  );
  const previewRow = rows.find((r) => r.key === previewKey) ?? rows.find((r) => r.key === defaultKey) ?? rows[0];
  const previewHex = previewRow ? rowHex(previewRow) : null;
  const recolor: Recolor[] = [
    ...(tint && previewHex && isHex(previewHex) ? [{ hex: previewHex, tint }] : []),
    ...parts.slice(1).flatMap((part) => {
      const hex = partPreviewHex(part);
      return isHex(hex) ? [{ hex, tint: part.tint }] : [];
    }),
  ];

  // ---- model upload ----------------------------------------------------------
  async function chooseFile(f: File | undefined) {
    if (!f) return;
    setErrors({});
    setFormError('');
    if (!/\.glb$/i.test(f.name)) return setErrors({ model: 'Please choose a .glb file.' });
    if (f.size > MAX_MB * 1024 * 1024) return setErrors({ model: `The file is larger than ${MAX_MB} MB.` });
    setUploading(true);
    try {
      const uploaded = await uploadModel(token, f);
      const tinted = uploaded.materials.filter((m) => m.suggested).map((m) => m.index);
      const firstTinted = uploaded.materials.find((m) => tinted.includes(m.index));
      const original: ColourRow = {
        key: newKey(),
        name: firstTinted ? nameColour(firstTinted.hex) : 'Standard',
        hex: firstTinted?.hex ?? '#000000',
        fabric: '',
        sku: '',
        original: true,
        autoName: true,
      };
      setFile(f);
      setPreviewUrl(makeUrl(f));
      setHistory([]);
      setSplitFor(null);
      setModel(uploaded);
      setTintSet(new Set(tinted));
      // Pre-ticked materials start as one part: they're the upholstery (or the main body).
      const firstName = tinted.length === 1 && firstTinted?.largest ? 'Body' : 'Fabric';
      setPartOf(Object.fromEntries(tinted.map((i) => [i, firstName])));
      setPalettes({});
      setPreviewPicks({});
      setEditing(null);
      setHighlight(null);
      setRows([original]);
      setDefaultKey(original.key);
      setPreviewKey(original.key);
      const scale = uploaded.dimensionsMm ? guessScale(uploaded.dimensionsMm) : 1;
      setModelScale(scale);
      if (!name.trim()) setName(f.name.replace(/\.glb$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    } catch (e) {
      if (!handleAuthFailure(e)) setErrors({ model: e instanceof Error ? e.message : 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void chooseFile(e.dataTransfer.files[0]);
  }

  function toggleTint(index: number) {
    if (tintSet.has(index)) setPreviewEpoch((n) => n + 1);
    else {
      // A newly ticked material becomes a part of its own, named after it (rename it to join another part).
      const m = model?.materials.find((x) => x.index === index);
      setPartOf((p) => ({ ...p, [index]: p[index] ?? partNameOf(m?.name ?? '', `Part ${parts.length + 1}`) }));
    }
    setTintSet((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    // With nothing recolourable only the original can stay.
    if (tintSet.size === 1 && tintSet.has(index)) setRows((r) => r.filter((x) => x.original));
  }

  // ---- split by part ----------------------------------------------------------
  function openSplit(m: ModelMaterial) {
    setSplitFor((current) => (current === m.index ? null : m.index));
    setSplitPick(new Set());
    setSplitName('');
    setSplitError('');
  }

  function togglePart(node: number) {
    setSplitPick((current) => {
      const next = new Set(current);
      if (next.has(node)) next.delete(node);
      else next.add(node);
      return next;
    });
  }

  async function doSplit(m: ModelMaterial) {
    if (!model || !splitPick.size) return;
    if (splitPick.size === m.parts.length) {
      setSplitError('Leave at least one part behind: splitting every part changes nothing.');
      return;
    }
    setSplitting(true);
    setSplitError('');
    try {
      const picked = m.parts.filter((part) => splitPick.has(part.node));
      const stems = new Set(picked.map((part) => partStem(part.name)));
      const name = splitName.trim() || (stems.size === 1 ? `${[...stems][0]} parts` : `${m.name} (part)`);
      const next = await splitModel(token, model.sha256, model.filename, [{ material: m.index, nodes: [...splitPick], name }]);
      const url = makeUrl(await fetchAdminModel(token, next.sha256));
      setHistory((h) => [...h, { model, previewUrl }]);
      setModel(next);
      setPreviewUrl(url);
      setSplitFor(null);
      // Split off a recolourable material: the new one is ticked too, as its own part under the name given.
      const fromTinted = next.created.filter((c) => tintSet.has(c.from));
      if (fromTinted.length) {
        setTintSet((current) => new Set([...current, ...fromTinted.map((c) => c.index)]));
        setPartOf((p) => ({ ...p, ...Object.fromEntries(fromTinted.map((c) => [c.index, c.name.slice(0, 40)])) }));
      }
      setHighlight(next.created[0]?.index ?? null); // show what was split off
    } catch (e) {
      if (!handleAuthFailure(e)) setSplitError(e instanceof Error ? e.message : 'Could not split the parts.');
    } finally {
      setSplitting(false);
    }
  }

  function undoSplit() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    setModel(previous.model);
    setPreviewUrl(previous.previewUrl);
    const kept = new Set(previous.model.materials.map((m) => m.index));
    setTintSet((current) => new Set([...current].filter((i) => kept.has(i))));
    setHighlight(null);
    setSplitFor(null);
  }

  // ---- dimensions ------------------------------------------------------------
  function editDimension(axis: Axis, raw: string) {
    setDims((d) => ({ ...d, [axis]: raw }));
    if (Number(raw) > 0) setAnchorAxis(axis);
  }

  /**
   * A suggested size per side, in the current unit: the model's shape scaled to the side
   * typed last, or the model's own (scale-corrected) size before anything is typed.
   */
  const suggestedDims = useMemo((): Record<Axis, number> | null => {
    const shape = model?.dimensionsMm;
    if (!shape) return null;
    const typed = (a: Axis) => Number(dims[a]) > 0;
    const anchor = anchorAxis && typed(anchorAxis) ? anchorAxis : AXES.find(typed);
    const size = anchor && shape[anchor] > 0 ? scaleSize(shape, Number(dims[anchor]) / UNITS[unit].perMm / shape[anchor]) : scaleSize(shape, modelScale);
    return { width: fromMm(size.width, unit), height: fromMm(size.height, unit), depth: fromMm(size.depth, unit) };
  }, [model, dims, anchorAxis, unit, modelScale]);
  const emptyAxes = AXES.filter((a) => !dims[a].trim());

  /** Copy the suggestions into the sides still left empty; typed sides are kept. */
  function fillSuggested() {
    if (!suggestedDims) return;
    setDims((d) => {
      const out = { ...d };
      for (const axis of AXES) if (!d[axis].trim()) out[axis] = String(suggestedDims[axis]);
      return out;
    });
  }

  function changeUnit(next: Unit) {
    setDims((d) => {
      const out = { ...d };
      for (const axis of AXES) {
        const v = Number(d[axis]);
        if (d[axis].trim() && Number.isFinite(v)) out[axis] = String(fromMm(v / UNITS[unit].perMm, next));
      }
      return out;
    });
    setUnit(next);
  }

  // ---- colours ---------------------------------------------------------------
  function addColour(hex: string, colourName: string) {
    const row: ColourRow = { key: newKey(), name: colourName, hex, fabric: rows[0]?.fabric ?? '', sku: '', original: false };
    setRows((r) => [...r, row]);
    setPreviewKey(row.key);
    setEditing(`main/${row.key}`);
    setErrors((er) => ({ ...er, colours: '' }));
  }

  const updateRow = (key: string, patch: Partial<ColourRow>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  function removeRow(key: string) {
    setRows((r) => r.filter((x) => x.key !== key));
    if (defaultKey === key) setDefaultKey(rows[0].key);
    if (previewKey === key) setPreviewKey(defaultKey === key ? rows[0].key : defaultKey);
  }

  // ---- extra parts -----------------------------------------------------------
  const updatePalette = (part: Part, patch: (p: Palette) => Palette) =>
    setPalettes((all) => ({ ...all, [part.key]: patch(all[part.key] ?? EMPTY_PALETTE) }));

  function addPartColour(part: Part, hex: string, colourName: string) {
    const row: PaletteRow = { key: newKey(), name: colourName, hex };
    updatePalette(part, (p) => ({ ...p, rows: [...p.rows, row] }));
    setPreviewPicks((picks) => ({ ...picks, [part.key]: row.key }));
    setEditing(`${part.key}/${row.key}`);
    setErrors((er) => ({ ...er, parts: '' }));
  }

  /** Rename a part (all its materials). Typing another part's name merges the two. */
  const renamePart = (part: Part, value: string) =>
    setPartOf((p) => ({ ...p, ...Object.fromEntries(part.materials.map((m) => [m.index, value])) }));

  function partRowWarning(part: Part, row: PaletteRow): string | null {
    if (!isHex(row.hex)) return 'Enter a colour like #1E4FD8.';
    const colours = partColours(part);
    const twin = colours.slice(0, colours.findIndex((c) => c.key === row.key)).find((o) => deltaE(o.hex, row.hex) < SAME_COLOUR_DE);
    if (twin) return `Looks almost the same as “${twin.name || 'another colour'}”.`;
    if (!isAchievable(row.hex, part.tint)) return `This texture can't reach this colour; it will show as ${achievedHex(row.hex, part.tint.materials[0].texAvg)}.`;
    return null;
  }

  function rowWarning(r: ColourRow): string | null {
    if (r.original || !tint || !baseHex) return null;
    if (!isHex(r.hex)) return 'Enter a colour like #1E4FD8.';
    if (deltaE(r.hex, baseHex) < SAME_COLOUR_DE) return 'Looks almost the same as the original colour.';
    const twin = rows.find((o) => o.key !== r.key && !o.original && rows.indexOf(o) < rows.indexOf(r) && isHex(o.hex) && deltaE(o.hex, r.hex) < SAME_COLOUR_DE);
    if (twin) return `Looks almost the same as “${twin.name || 'another colour'}”.`;
    if (!isAchievable(r.hex, tint)) return `This fabric texture can't reach this colour; it will show as ${achievedHex(r.hex, tint.materials[0].texAvg)}.`;
    return null;
  }

  // ---- submit ----------------------------------------------------------------
  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!model) e.model = 'Upload a GLB model first.';
    if (!name.trim()) e.name = 'Product name is required.';
    if (categoryId === NEW_CATEGORY ? !newCategory.trim() : !categoryId) e.category = 'Choose or create a category.';
    for (const axis of AXES) {
      const v = dims[axis].trim();
      if (!v) continue;
      if (!(Number(v) > 0)) e.dimensions = 'Sizes must be positive numbers (or left empty).';
      else if (Number(v) / UNITS[unit].perMm > MAX_SIZE_MM) e.dimensions = `${axis[0].toUpperCase()}${axis.slice(1)} is too large: the limit is ${formatLength(MAX_SIZE_MM, unit)} (100 m).`;
    }
    // The file's own size is wrong here, so without a typed size the product would show at that wrong size.
    if (modelScale !== 1 && emptyAxes.length === AXES.length) e.dimensions = 'This file was exported at the wrong scale: enter the real size (or use the suggestion).';
    const names = rows.map((r) => r.name.trim().toLowerCase());
    if (names.some((n) => !n)) e.colours = 'Every colour needs a name.';
    else if (new Set(names).size !== names.length) e.colours = 'Colour names must be different.';
    else if (rows.some((r) => !r.original && !isHex(r.hex))) e.colours = 'Fix the colour values.';
    if (multiPart && parts.some((part) => !part.name)) e.parts = 'Every part needs a name.';
    for (const part of parts.slice(1)) {
      const colours = partColours(part);
      if (colours.length < 2) e.parts = `${part.name || 'A part'} has only its own colour: add another, or untick it in step 1.`;
      const partNames = colours.map((c) => c.name.trim().toLowerCase());
      if (partNames.some((n) => !n)) e.parts = `${part.name}: every colour needs a name.`;
      else if (new Set(partNames).size !== partNames.length) e.parts = `${part.name}: colour names must be different.`;
      else if (colours.some((c) => !isHex(c.hex))) e.parts = `${part.name}: fix the colour values.`;
    }
    return e;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(Object.keys(found).length ? 'Please fix the highlighted fields.' : '');
    if (Object.keys(found).length || !model) return;
    setSaving(true);
    try {
      const dimensions: { unit: Unit } & Partial<Record<Axis, number>> = { unit };
      for (const axis of AXES) if (dims[axis].trim()) dimensions[axis] = Number(dims[axis]);
      setCreated(
        await createProduct(token, {
          name: name.trim(),
          description: description.trim() || undefined,
          status,
          ...(categoryId === NEW_CATEGORY ? { newCategory: newCategory.trim() } : { categoryId }),
          model: {
            sha256: model.sha256,
            filename: model.filename,
            tintMaterials: [...tintSet],
            parts: multiPart
              ? parts.map((part, i) => ({
                  name: part.name,
                  materials: part.materials.map((m) => m.index),
                  colours: i === 0 ? [] : partColours(part).map((c) => ({ name: c.name.trim(), hex: c.hex })),
                }))
              : undefined,
          },
          dimensions,
          colours: rows.map((r) => ({
            name: r.name.trim(),
            hex: tint ? (rowHex(r) ?? undefined) : undefined,
            fabric: r.fabric.trim() || undefined,
            sku: r.sku.trim() || undefined,
            isDefault: r.key === defaultKey,
          })),
        }),
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (handleAuthFailure(err)) return;
      setFormError(err instanceof Error ? err.message : 'Could not save the product.');
      if (err instanceof AdminApiError) setErrors(err.fieldErrors);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setCreated(null);
    setFile(null);
    setPreviewUrl(null);
    setModel(null);
    setHistory([]);
    setSplitFor(null);
    setTintSet(new Set());
    setPartOf({});
    setPalettes({});
    setPreviewPicks({});
    setEditing(null);
    setName('');
    setDescription('');
    setCategoryId(categories.length ? '' : NEW_CATEGORY);
    setCategoryPicked(false);
    setNewCategory('');
    setDims({ width: '', height: '', depth: '' });
    setAnchorAxis(null);
    setModelScale(1);
    setRows([]);
    setErrors({});
    setFormError('');
  }

  if (!token) return <AdminSignIn onSignIn={signIn} purpose="upload models" error={authError} />;

  const editPartRow = (part: Part, key: string, patch: Partial<PaletteRow>) =>
    updatePalette(part, (p) => ({ ...p, rows: p.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  /**
   * Step 4 for one part: its colours as chips (click one to see it in the preview and edit it),
   * then one-click suggestions. `part` is null when nothing is ticked: one fixed colour.
   */
  function renderColourCard(part: Part | null, i: number) {
    const main = i === 0;
    const items = main
      ? rows.map((r) => ({ key: r.key, name: r.name, hex: rowHex(r) ?? '', original: r.original }))
      : partColours(part!).map((c) => ({ ...c, original: c.key === 'original' }));
    const shownKey = main ? previewRow?.key : items.some((c) => c.key === previewPicks[part!.key]) ? previewPicks[part!.key] : 'original';
    const offered = !part ? [] : main ? suggestions : suggestColours(part.baseHex, part.tint, items.map((c) => c.hex));
    const id = (key: string) => `${main ? 'main' : part!.key}/${key}`;
    const open = items.find((c) => editing === id(c.key));
    const warningOf = (key: string) => {
      if (main) return rowWarning(rows.find((r) => r.key === key)!);
      const row = paletteOf(part!).rows.find((r) => r.key === key);
      return row ? partRowWarning(part!, row) : null;
    };
    const select = (key: string) => {
      if (main) setPreviewKey(key);
      else setPreviewPicks((picks) => ({ ...picks, [part!.key]: key }));
      setEditing((e) => (e === id(key) ? null : id(key)));
    };
    const rename = (key: string, value: string) => {
      if (main) updateRow(key, { name: value, autoName: false });
      else if (key === 'original') updatePalette(part!, (pal) => ({ ...pal, originalName: value }));
      else editPartRow(part!, key, { name: value });
    };
    const setHex = (key: string, hex: string) => (main ? updateRow(key, { hex }) : editPartRow(part!, key, { hex }));
    const remove = (key: string) => {
      if (main) removeRow(key);
      else updatePalette(part!, (pal) => ({ ...pal, rows: pal.rows.filter((r) => r.key !== key) }));
      setEditing(null);
    };
    const add = (hex: string, colourName: string) => (main ? addColour(hex, colourName) : addPartColour(part!, hex, colourName));
    const mainRow = open && main ? rows.find((r) => r.key === open.key) : undefined;
    const openWarning = open && !open.original ? warningOf(open.key) : null;

    return (
      <div
        key={part?.key ?? 'none'}
        onMouseEnter={() => multiPart && part && setHighlight(part.key)}
        onMouseLeave={() => multiPart && setHighlight(null)}
        className="rounded-2xl border border-line/10 p-5"
      >
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          {multiPart && part ? (
            <input
              value={partOf[part.key] ?? part.materials[0].name}
              onChange={(e) => renamePart(part, e.target.value)}
              placeholder="Name this part"
              maxLength={40}
              aria-label="Part name"
              title="Rename this part"
              className="min-w-[8rem] flex-1 border-b border-dashed border-line/25 bg-transparent pb-0.5 text-base font-medium text-fg placeholder:text-fg-subtle hover:border-line/50 focus:border-fg focus:outline-none"
            />
          ) : (
            <p className="text-base font-medium text-fg">Colours</p>
          )}
          {multiPart && main && (
            <span className="rounded-full bg-fg/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-fg-muted">Main · catalogue options</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.map((c) => {
            const warn = !c.original && warningOf(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => select(c.key)}
                aria-pressed={shownKey === c.key}
                aria-expanded={editing === id(c.key)}
                className={cn(
                  'flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors',
                  editing === id(c.key) ? 'border-fg bg-fg/[0.06]' : shownKey === c.key ? 'border-fg/50' : 'border-line/15 hover:border-fg/40',
                )}
              >
                <span className="h-6 w-6 shrink-0 rounded-full border border-line/20" style={{ backgroundColor: isHex(c.hex) ? c.hex : 'transparent' }} aria-hidden />
                {c.name.trim() || <span className="text-fg-subtle">Name it</span>}
                {main && rows.length > 1 && defaultKey === c.key && <span className="text-[10px] uppercase tracking-wider text-fg-subtle">first</span>}
                {warn && <AlertTriangle size={12} className="text-amber-500" aria-label="Has a warning" />}
              </button>
            );
          })}
          {part && (
            <button
              type="button"
              onClick={() => add(offered[0]?.hex ?? '#808080', '')}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-line/30 px-3 py-1.5 text-xs text-fg-muted hover:border-fg hover:text-fg"
            >
              <Plus size={13} aria-hidden /> Custom colour
            </button>
          )}
        </div>

        {open && (
          <div className="mt-3 rounded-xl bg-fg/[0.03] p-4">
            <div className="flex flex-wrap items-end gap-3">
              {part && !open.original && (
                <label className="relative block h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-full border border-line/20" title="Pick a colour">
                  <span className="absolute inset-0" style={{ backgroundColor: isHex(open.hex) ? open.hex : 'transparent' }} />
                  <input
                    type="color"
                    value={isHex(open.hex) ? open.hex : '#000000'}
                    onChange={(e) => setHex(open.key, e.target.value.toUpperCase())}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label={`Colour for ${open.name || 'this option'}`}
                  />
                </label>
              )}
              <label className="min-w-[140px] flex-1">
                <span className={labelCls}>
                  Colour name *{open.original && <span className="ml-2 normal-case tracking-normal text-fg-subtle">(model&apos;s own)</span>}
                </span>
                <input className={inputCls} value={open.name} maxLength={80} autoFocus={!open.name} onChange={(e) => rename(open.key, e.target.value)} />
              </label>
              {part && !open.original && (
                <label className="w-28">
                  <span className={labelCls}>Hex</span>
                  <input className={inputCls} value={open.hex} maxLength={7} onChange={(e) => setHex(open.key, e.target.value.trim().toUpperCase())} />
                </label>
              )}
              {mainRow && (
                <>
                  <label className="w-32">
                    <span className={labelCls}>Fabric</span>
                    <input className={inputCls} list="fabric-options" value={mainRow.fabric} maxLength={80} onChange={(e) => updateRow(mainRow.key, { fabric: e.target.value })} placeholder="Velvet" />
                  </label>
                  <label className="w-36">
                    <span className={labelCls}>SKU</span>
                    <input className={inputCls} value={mainRow.sku} maxLength={40} onChange={(e) => updateRow(mainRow.key, { sku: e.target.value.toUpperCase() })} placeholder="Auto" />
                  </label>
                </>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
              {mainRow && rows.length > 1 && (
                <label className="flex cursor-pointer items-center gap-1.5 text-fg-muted">
                  <input type="checkbox" checked={defaultKey === mainRow.key} onChange={() => setDefaultKey(mainRow.key)} />
                  Show this colour first
                </label>
              )}
              {openWarning && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={13} aria-hidden /> {openWarning}
                </span>
              )}
              {!open.original && (
                <button type="button" onClick={() => remove(open.key)} className="ml-auto flex items-center gap-1 text-fg-subtle hover:text-red-500">
                  <Trash2 size={13} aria-hidden /> Remove
                </button>
              )}
            </div>
          </div>
        )}

        {!main && items.length < 2 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle size={14} aria-hidden /> Add at least one more colour, or customers can&apos;t change the {part!.name.toLowerCase() || 'part'}.
          </p>
        )}

        {offered.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-fg-subtle">Add a suggested colour</p>
            <div className="flex flex-wrap gap-1.5">
              {offered.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => add(c.hex, c.name)}
                  title={c.name}
                  aria-label={`Add ${c.name}`}
                  className="h-7 w-7 rounded-full border border-line/20 transition-transform hover:scale-110"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
        )}
        {!part && <p className="mt-4 text-sm text-fg-muted">To offer more colours, tick the part that changes colour in step 1.</p>}
      </div>
    );
  }

  const header = (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-fg-subtle">
          <Link to="/admin" className="hover:text-fg">
            ← Admin
          </Link>{' '}
          ·{' '}
          <Link to="/admin/models" className="hover:text-fg">
            All models
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-light">Upload a 3D model</h1>
        <p className="mt-1 text-sm text-fg-muted">Add a GLB, choose the parts that change colour, and offer colour options.</p>
      </div>
      <Button variant="outline" size="md" onClick={signOut} icon={<LogOut size={14} />}>
        Sign out
      </Button>
    </header>
  );

  if (created) {
    const def = created.variants.find((v) => v.isDefault) ?? created.variants[0];
    return (
      <main className="min-h-screen bg-surface px-6 py-10 text-fg md:px-12">
        <div className="mx-auto max-w-3xl">
          {header}
          <div className="rounded-3xl border border-line/10 bg-surface-raised p-8 text-center" role="status">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" aria-hidden />
            <h2 className="text-2xl font-light">{name.trim()} is saved</h2>
            <p className="mt-2 text-sm text-fg-muted">
              {created.variants.length} {created.variants.length === 1 ? 'option' : 'options'}:{' '}
              {created.variants.map((v) => `${v.name} (${v.sku})`).join(', ')}.
            </p>
            {created.product.status === 'draft' ? (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">Saved as a draft: it is hidden from the public site.</p>
            ) : (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link to={viewPath(def.id)} className="rounded-full bg-fg px-6 py-2.5 text-xs uppercase tracking-[0.15em] text-surface">
                  Open product page
                </Link>
                <Link to="/experience" className="rounded-full border border-fg/25 px-6 py-2.5 text-xs uppercase tracking-[0.15em]">
                  See it in the catalogue
                </Link>
              </div>
            )}
            <button type="button" onClick={reset} className="mt-6 text-sm text-fg-soft underline underline-offset-4">
              Upload another model
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-10 text-fg md:px-12">
      <div className="mx-auto max-w-7xl">
        {header}
        <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-7">
            {/* 1. Model ------------------------------------------------------ */}
            <Section step={1} title="Model file" hint={`A binary glTF (.glb), up to ${MAX_MB} MB.`}>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-8 text-center transition-colors',
                  dragging ? 'border-fg bg-fg/5' : 'border-line/25',
                )}
              >
                <Upload className="h-6 w-6 text-fg-subtle" aria-hidden />
                {file && model ? (
                  <p className="text-sm text-fg">
                    {file.name} <span className="text-fg-muted">· {(model.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                  </p>
                ) : (
                  <p className="text-sm text-fg-muted">Drag a .glb file here, or</p>
                )}
                <Button type="button" variant="outline" size="md" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  {uploading ? 'Uploading & analysing…' : file ? 'Replace file' : 'Choose file'}
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".glb,model/gltf-binary"
                  className="hidden"
                  onChange={(e) => {
                    void chooseFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
              <FieldError msg={errors.model} />

              {model && (
                <div className="mt-6">
                  <p className={labelCls}>Which parts change colour?</p>
                  <p className="mb-3 text-sm text-fg-muted">
                    Each material is one part of the model, biggest first. Hover a row (or tap <Eye size={12} className="inline" aria-label="show" />) to make
                    that part glow in the preview, then tick the parts customers can change. You choose each part&apos;s colours in step 4.
                  </p>
                  <ul className="space-y-2">
                    {model.materials.map((m) => (
                      <li
                        key={m.index}
                        onMouseEnter={() => setHighlight(m.index)}
                        onMouseLeave={() => setHighlight((h) => (h === m.index ? null : h))}
                      >
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                            tintSet.has(m.index) ? 'border-fg/50 bg-fg/[0.04]' : 'border-line/10 hover:border-line/30',
                          )}
                        >
                          <input type="checkbox" checked={tintSet.has(m.index)} onChange={() => toggleTint(m.index)} className="h-4 w-4 accent-current" />
                          <span className="h-6 w-6 shrink-0 rounded-full border border-line/20" style={{ backgroundColor: m.hex }} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-sm text-fg">
                              <span className="truncate">{m.name}</span>
                              {m.largest && (
                                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                  Main body
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-fg-muted">
                              {nameColour(m.hex)} · {m.hex}
                              {m.textured ? ' · textured' : ''}
                              {m.share !== null && <> · {m.share < 0.01 ? 'under 1%' : `${Math.round(m.share * 100)}%`} of the surface</>}
                            </span>
                            {m.share !== null && (
                              <span className="mt-1.5 block h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-fg/10" aria-hidden>
                                <span className="block h-full rounded-full bg-fg/50" style={{ width: `${Math.max(2, m.share * 100)}%` }} />
                              </span>
                            )}
                            {m.parts.length > 0 && (
                              <span className="mt-1 block truncate text-[11px] text-fg-subtle" title={m.parts.map((part) => part.name).join(', ')}>
                                {m.parts.length === 1 ? 'Part' : `${m.parts.length} parts`}: {m.parts.map((part) => part.name).join(', ')}
                              </span>
                            )}
                          </span>
                          {m.glows && tintSet.has(m.index) && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" title="This part is a light: its glow covers its colour, so colour changes barely show.">
                              <AlertTriangle size={13} aria-hidden /> Glowing part
                            </span>
                          )}
                          {m.patterned && tintSet.has(m.index) && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" title="The texture has its own colour, so only nearby colours can be reached.">
                              <AlertTriangle size={13} aria-hidden /> Coloured texture
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setHighlight((h) => (h === m.index ? null : m.index));
                            }}
                            aria-pressed={highlight === m.index}
                            aria-label={`Show ${m.name} in the preview`}
                            title="Show this part in the preview"
                            className={cn(
                              'shrink-0 rounded-full p-1.5 transition-colors',
                              highlight === m.index ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'text-fg-subtle hover:text-fg',
                            )}
                          >
                            <Eye size={15} aria-hidden />
                          </button>
                        </label>
                        {m.parts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => openSplit(m)}
                            aria-expanded={splitFor === m.index}
                            className="ml-11 mt-1 flex items-center gap-1 text-xs text-fg-soft underline-offset-4 hover:underline"
                          >
                            <Scissors size={12} aria-hidden /> {splitFor === m.index ? 'Cancel split' : 'Split parts…'}
                          </button>
                        )}
                        {splitFor === m.index && (
                          <div className="ml-11 mt-2 rounded-xl border border-line/15 bg-surface p-4">
                            <p className="text-xs text-fg-muted">
                              Tick the parts that should get <strong className="text-fg">their own colour</strong> (e.g. legs or handles). They become a new
                              material you can recolour separately; the rest stay as &ldquo;{m.name}&rdquo;.
                            </p>
                            {stemGroups(m.parts).length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {stemGroups(m.parts).map((g) => (
                                  <button
                                    key={g.stem}
                                    type="button"
                                    onClick={() => setSplitPick(new Set(g.nodes))}
                                    className="rounded-full border border-line/20 px-3 py-1 text-xs text-fg-muted hover:border-fg hover:text-fg"
                                  >
                                    All &ldquo;{g.stem}&rdquo; ×{g.nodes.length}
                                  </button>
                                ))}
                              </div>
                            )}
                            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
                              {m.parts.map((part) => (
                                <li key={part.node}>
                                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-fg/5">
                                    <input type="checkbox" checked={splitPick.has(part.node)} onChange={() => togglePart(part.node)} className="h-3.5 w-3.5" />
                                    <span className="min-w-0 flex-1 truncate text-fg">{part.name}</span>
                                    <span className="shrink-0 text-xs text-fg-subtle">{percent(part.share)}</span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-3 flex flex-wrap items-end gap-2">
                              <label className="min-w-[160px] flex-1">
                                <span className={labelCls}>Name for these parts</span>
                                <input
                                  className={inputCls}
                                  value={splitName}
                                  maxLength={60}
                                  onChange={(e) => setSplitName(e.target.value)}
                                  placeholder="e.g. Legs, Handles, Cushions"
                                />
                              </label>
                              <Button type="button" size="md" disabled={!splitPick.size || splitting} onClick={() => void doSplit(m)}>
                                {splitting ? 'Splitting…' : `Make separate (${splitPick.size})`}
                              </Button>
                            </div>
                            {splitError && (
                              <p role="alert" className="mt-2 text-xs text-red-500">
                                {splitError}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {history.length > 0 && (
                    <button type="button" onClick={undoSplit} className="mt-3 flex items-center gap-1.5 text-xs text-fg-soft hover:text-fg">
                      <Undo2 size={13} aria-hidden /> Undo last split
                    </button>
                  )}
                  {multiPart ? (
                    <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
                      {parts.length} parts with their own colours (set in step 4):
                      {parts.map((part) => (
                        <span key={part.key} className="flex items-center gap-1.5">
                          <span className="h-4 w-4 rounded-full border border-line/20" style={{ backgroundColor: part.baseHex }} aria-hidden />
                          <strong className="font-medium text-fg">{part.name}</strong>
                        </span>
                      ))}
                    </p>
                  ) : baseHex ? (
                    <p className="mt-4 flex items-center gap-2 text-sm text-fg-muted">
                      Detected model colour:
                      <span className="h-4 w-4 rounded-full border border-line/20" style={{ backgroundColor: baseHex }} aria-hidden />
                      <strong className="font-medium text-fg">{nameColour(baseHex)}</strong> {baseHex}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm text-fg-muted">Nothing ticked: the model will be shown exactly as uploaded, in one colour.</p>
                  )}
                </div>
              )}
            </Section>

            {/* 2. Details ---------------------------------------------------- */}
            <Section step={2} title="Product details">
              <div className="space-y-4">
                <label className="block">
                  <span className={labelCls}>Product name *</span>
                  <input className={inputCls} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Upholstered Dining Chair" />
                  <FieldError msg={errors.name} />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelCls}>Category *</span>
                    <select
                      className={cn(inputCls, !categoryId && 'text-fg-subtle')}
                      value={categoryId}
                      onChange={(e) => {
                        setCategoryId(e.target.value);
                        setCategoryPicked(true);
                      }}
                    >
                      <option value="" disabled>
                        Choose a category…
                      </option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                      <option value={NEW_CATEGORY}>+ New category…</option>
                    </select>
                    {suggestedCategory && categoryId === suggestedCategory.id ? (
                      <span className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-subtle">
                        <Sparkles size={12} aria-hidden /> Suggested from the name. Change it if it&apos;s wrong.
                      </span>
                    ) : suggestedCategory ? (
                      <span className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-subtle">
                        <Sparkles size={12} aria-hidden /> Suggested: {suggestedCategory.name}
                        <button
                          type="button"
                          onClick={() => setCategoryId(suggestedCategory.id)}
                          className="text-fg underline underline-offset-4"
                        >
                          Use it
                        </button>
                      </span>
                    ) : (
                      !categoryId && name.trim() && (
                        <span className="mt-1.5 block text-xs text-fg-subtle">No match from the name. Pick one, or create a new one.</span>
                      )
                    )}
                  </label>
                  {categoryId === NEW_CATEGORY && (
                    <label className="block">
                      <span className={labelCls}>New category name *</span>
                      <input className={inputCls} value={newCategory} maxLength={60} onChange={(e) => setNewCategory(e.target.value)} placeholder="Tables" />
                    </label>
                  )}
                </div>
                <FieldError msg={errors.category} />
                <label className="block">
                  <span className={labelCls}>Description</span>
                  <textarea className={cn(inputCls, 'min-h-[90px]')} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
                  <FieldError msg={errors.description} />
                </label>
                <div>
                  <span className={labelCls}>Visibility</span>
                  <div className="flex gap-2">
                    {(['active', 'draft'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={cn(
                          'rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.12em] transition-colors',
                          status === s ? 'border-fg bg-fg text-surface' : 'border-line/15 text-fg-muted hover:border-fg',
                        )}
                      >
                        {s === 'active' ? 'Publish now' : 'Save as draft'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* 3. Dimensions ------------------------------------------------- */}
            <Section step={3} title="Dimensions" hint="Optional. Enter the real product size; suggestions come from the model's shape.">
              <div className="mb-4 flex items-center gap-2">
                {(Object.keys(UNITS) as Unit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => changeUnit(u)}
                    aria-pressed={unit === u}
                    className={cn(
                      'rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.12em] transition-colors',
                      unit === u ? 'border-fg bg-fg text-surface' : 'border-line/15 text-fg-muted hover:border-fg',
                    )}
                  >
                    {UNITS[u].label}
                  </button>
                ))}
                {suggestedDims && emptyAxes.length > 0 && (
                  <button type="button" onClick={fillSuggested} className="ml-auto text-xs text-fg-soft underline underline-offset-4">
                    {emptyAxes.length === AXES.length ? 'Use suggested size' : 'Fill the rest with suggestions'}
                  </button>
                )}
              </div>
              {model?.dimensionsMm && modelScale !== 1 && (
                <div role="note" className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                  <p className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      This file says the model is <strong>{describeSize(model.dimensionsMm)}</strong>, which can&apos;t be real furniture: it was
                      exported at the wrong scale. <strong>Enter the real size.</strong> Type one side and the others are suggested from the
                      model&apos;s shape.
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-fg-muted">
                    AR draws the model at the size you save here (when its shape matches), so the file doesn&apos;t need re-exporting.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                {AXES.map((axis) => {
                  const hint = suggestedDims && !dims[axis].trim() ? suggestedDims[axis] : null;
                  return (
                    <label key={axis} className="block">
                      <span className={labelCls}>{axis}</span>
                      <div className="relative">
                        <input
                          className={cn(inputCls, 'pr-10')}
                          inputMode="decimal"
                          value={dims[axis]}
                          placeholder={hint !== null ? String(hint) : undefined}
                          onChange={(e) => editDimension(axis, e.target.value)}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-subtle">{UNITS[unit].label}</span>
                      </div>
                      {hint !== null && (
                        <button
                          type="button"
                          onClick={() => editDimension(axis, String(hint))}
                          className="mt-1.5 text-xs text-fg-subtle hover:text-fg"
                          title="Use this suggestion"
                        >
                          Suggested: <span className="underline underline-offset-4">{hint} {UNITS[unit].label}</span>
                        </button>
                      )}
                    </label>
                  );
                })}
              </div>
              <FieldError msg={errors.dimensions} />
            </Section>

            {/* 4. Colours ---------------------------------------------------- */}
            <Section
              step={4}
              title="Colour options"
              hint={
                multiPart
                  ? 'Each part gets its own colours. The main part’s colours are the catalogue options (each with its own SKU); customers can mix them with the other parts’ colours.'
                  : tint
                    ? 'The first is the model’s own colour. Click a colour to edit it, or add more from the suggestions.'
                    : undefined
              }
            >
              {!model ? (
                <p className="text-sm text-fg-muted">Upload a model first.</p>
              ) : (
                <div className="space-y-4">
                  {(parts.length ? parts : [null]).map((part, i) => renderColourCard(part, i))}
                </div>
              )}
              <datalist id="fabric-options">
                {FABRICS.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
              <FieldError msg={errors.colours} />
              <FieldError msg={errors.parts} />
            </Section>

            {formError && (
              <p role="alert" className="text-sm text-red-500">
                {formError}
              </p>
            )}
            <Button type="submit" disabled={saving || uploading || !model} className="w-full sm:w-auto">
              {saving ? 'Saving…' : status === 'active' ? 'Publish product' : 'Save draft'}
            </Button>
          </div>

          {/* Live preview ----------------------------------------------------- */}
          <aside className="min-w-0 lg:col-span-5">
            <div className="space-y-4 lg:sticky lg:top-8">
              <div className="relative h-[420px] overflow-hidden rounded-3xl border border-line/10 bg-surface-raised md:h-[520px]">
                <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
                {previewUrl ? (
                  <ErrorBoundary
                    resetKey={previewUrl}
                    fallback={
                      <p role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-fg-muted">
                        The preview hit a problem with this model. You can still fill in the form and save.
                      </p>
                    }
                  >
                    <ModelViewer key={previewEpoch} src={previewUrl} alt="Preview of the uploaded model" recolor={recolor} highlight={highlight} />
                  </ErrorBoundary>
                ) : (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-fg-subtle">The 3D preview appears here.</p>
                )}
              </div>
              {tint && rows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3" role="radiogroup" aria-label={multiPart ? `Preview colour for ${parts[0].name}` : 'Preview colour'}>
                    {multiPart && <span className="w-24 truncate text-xs uppercase tracking-[0.12em] text-fg-subtle">{parts[0].name}</span>}
                    {rows.map((r) => {
                      const hex = rowHex(r);
                      return (
                        <button
                          key={r.key}
                          type="button"
                          role="radio"
                          aria-checked={previewRow?.key === r.key}
                          title={r.name}
                          onClick={() => setPreviewKey(r.key)}
                          className={cn(
                            'h-8 w-8 rounded-full border border-line/20 transition-all',
                            previewRow?.key === r.key ? 'scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface' : 'hover:scale-105',
                          )}
                          style={{ backgroundColor: hex && isHex(hex) ? hex : 'transparent' }}
                        />
                      );
                    })}
                    <span className="text-sm text-fg-muted">{previewRow?.name}</span>
                  </div>
                  {parts.slice(1).map((part) => {
                    const colours = partColours(part);
                    const current = colours.find((c) => c.key === previewPicks[part.key]) ?? colours[0];
                    return (
                      <div key={part.key} className="flex flex-wrap items-center gap-3" role="radiogroup" aria-label={`Preview colour for ${part.name}`}>
                        <span className="w-24 truncate text-xs uppercase tracking-[0.12em] text-fg-subtle">{part.name}</span>
                        {colours.map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            role="radio"
                            aria-checked={current.key === c.key}
                            title={c.name}
                            onClick={() => setPreviewPicks((picks) => ({ ...picks, [part.key]: c.key }))}
                            className={cn(
                              'h-8 w-8 rounded-full border border-line/20 transition-all',
                              current.key === c.key ? 'scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface' : 'hover:scale-105',
                            )}
                            style={{ backgroundColor: isHex(c.hex) ? c.hex : 'transparent' }}
                          />
                        ))}
                        <span className="text-sm text-fg-muted">{current.name}</span>
                      </div>
                    );
                  })}
                  {multiPart && <p className="text-xs text-fg-subtle">This is how customers will mix the parts.</p>}
                </div>
              )}
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}
