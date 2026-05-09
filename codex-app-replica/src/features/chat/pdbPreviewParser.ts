const RESIDUE_SEQUENCE_CODES: Record<string, string> = {
  A: "A",
  ALA: "A",
  ARG: "R",
  ASN: "N",
  ASP: "D",
  ASX: "B",
  C: "C",
  CYS: "C",
  CYM: "C",
  CYX: "C",
  DA: "A",
  DC: "C",
  DG: "G",
  DT: "T",
  DU: "U",
  G: "G",
  GLN: "Q",
  GLU: "E",
  GLX: "Z",
  GLY: "G",
  HIS: "H",
  HSD: "H",
  HSE: "H",
  HSP: "H",
  ILE: "I",
  LEU: "L",
  LYS: "K",
  M: "M",
  MET: "M",
  MSE: "M",
  PHE: "F",
  PRO: "P",
  PYL: "O",
  SEC: "U",
  SEP: "S",
  SER: "S",
  T: "T",
  THR: "T",
  TPO: "T",
  TRP: "W",
  TYR: "Y",
  U: "U",
  VAL: "V",
};

export type PdbAtom = {
  atomName: string;
  bFactor: number | null;
  chainId: string;
  element: string;
  insertionCode: string;
  isHetAtom: boolean;
  residueName: string;
  residueNumber: number;
  serial: number | null;
  x: number;
  y: number;
  z: number;
};

export type PdbResidue = {
  atomSerials: number[];
  chainId: string;
  insertionCode: string;
  residueName: string;
  residueNumber: number;
  sequenceCode: string;
};

export type PdbResidueChain = {
  chainId: string;
  residues: PdbResidue[];
  sequence: string;
};

export type PdbStats = {
  atomCount: number;
  chainCount: number;
  maxScore: number | null;
  meanScore: number | null;
  minScore: number | null;
  residueCount: number;
};

export type PdbModel = {
  atoms: PdbAtom[];
  chains: string[];
  contents: string;
  modelNumber: number;
  residueChains: PdbResidueChain[];
  stats: PdbStats;
  title: string | null;
  trace: PdbAtom[];
};

export type PdbPreviewData = {
  models: PdbModel[];
};

export type PdbSelection = {
  chainId: string;
  endIndex: number;
  modelIndex: number;
  startIndex: number;
};

export type PdbSelectionQuery =
  | { serial: number[] }
  | { or: Array<{ chain: string; icode: string; resi: number; resn: string }> };

export function parsePdbPreviewData(contents: string): PdbPreviewData {
  return {
    models: splitPdbModels(contents)
      .map((model) => {
        const atoms = parsePdbAtoms(model.contents);
        const trace = pickTraceAtoms(atoms);
        const residueChains = buildResidueChains(atoms);
        const chains = [...new Set(atoms.map((atom) => atom.chainId))].sort();

        return {
          atoms,
          chains,
          contents: model.contents,
          modelNumber: model.modelNumber,
          residueChains,
          stats: buildStats(atoms, trace),
          title: model.title,
          trace,
        };
      })
      .filter((model) => model.atoms.length > 0),
  };
}

export function getSelectedResidues(chain: PdbResidueChain | null, selection: PdbSelection | null) {
  if (chain == null || selection == null || selection.chainId !== chain.chainId) {
    return [] as PdbResidue[];
  }

  const startIndex = Math.max(0, Math.min(selection.startIndex, chain.residues.length - 1));
  const endIndex = Math.max(startIndex, Math.min(selection.endIndex, chain.residues.length - 1));
  return chain.residues.slice(startIndex, endIndex + 1);
}

export function buildPdbSelectionQuery(residues: PdbResidue[]) {
  if (residues.length === 0) {
    return null;
  }

  const atomSerials = [...new Set(residues.flatMap((residue) => residue.atomSerials))];
  if (atomSerials.length > 0) {
    return { serial: atomSerials };
  }

  return {
    or: residues.map((residue) => ({
      chain: residue.chainId,
      icode: residue.insertionCode,
      resi: residue.residueNumber,
      resn: residue.residueName,
    })),
  };
}

export function formatPdbResidueRange(residues: PdbResidue[]) {
  const first = residues[0];
  const last = residues.at(-1);
  if (first == null || last == null) {
    return "";
  }

  const chainId = formatPdbChainId(first.chainId);
  const firstResidue = formatPdbResidueId(first);
  const lastResidue = formatPdbResidueId(last);
  return firstResidue === lastResidue ? `${chainId}:${firstResidue}` : `${chainId}:${firstResidue}-${lastResidue}`;
}

export function formatPdbResidueId(residue: PdbResidue) {
  const insertionCode = residue.insertionCode.trim();
  return insertionCode.length > 0 ? `${residue.residueNumber}${insertionCode}` : String(residue.residueNumber);
}

export function formatPdbChainId(chainId: string) {
  return chainId.trim().length > 0 ? chainId : "(blank)";
}

function splitPdbModels(contents: string) {
  const lines = contents.split(/\r?\n/);
  if (!lines.some((line) => line.slice(0, 6).trim() === "MODEL")) {
    return [{ contents, modelNumber: 1, title: getRemarkTitle(lines) }];
  }

  const models: Array<{ lines: string[]; modelNumber: number; title: string | null }> = [];
  const prefixLines: string[] = [];
  let currentModel: { lines: string[]; modelNumber: number; title: string | null } | null = null;
  let nextModelNumber = 1;
  let sawModel = false;

  for (const line of lines) {
    const recordType = line.slice(0, 6).trim();
    if (recordType === "MODEL") {
      if (currentModel != null) {
        models.push(currentModel);
      }
      sawModel = true;
      currentModel = {
        lines: [line],
        modelNumber: parseInteger(line.slice(10, 14)) ?? nextModelNumber,
        title: null,
      };
      nextModelNumber += 1;
      continue;
    }

    if (currentModel == null) {
      if (!sawModel) {
        prefixLines.push(line);
      }
      continue;
    }

    currentModel.lines.push(line);
    if (currentModel.title == null && recordType === "REMARK") {
      currentModel.title = parseRemark(line);
    }
    if (recordType === "ENDMDL") {
      models.push(currentModel);
      currentModel = null;
    }
  }

  if (currentModel != null) {
    models.push(currentModel);
  }

  const title = getRemarkTitle(prefixLines);
  return models.map((model) => ({
    contents: [...prefixLines, ...model.lines].join("\n"),
    modelNumber: model.modelNumber,
    title: model.title ?? title,
  }));
}

function parsePdbAtoms(contents: string) {
  const atoms: PdbAtom[] = [];
  for (const line of contents.split(/\r?\n/)) {
    const recordType = line.slice(0, 6).trim();
    if (recordType !== "ATOM" && recordType !== "HETATM") {
      continue;
    }

    const atom = parsePdbAtomLine(line);
    if (atom != null) {
      atoms.push(atom);
    }
  }

  return atoms;
}

function parsePdbAtomLine(line: string) {
  const x = parseNumber(line.slice(30, 38));
  const y = parseNumber(line.slice(38, 46));
  const z = parseNumber(line.slice(46, 54));
  if (x == null || y == null || z == null) {
    return null;
  }

  const atomName = line.slice(12, 16).trim();
  const recordType = line.slice(0, 6).trim();

  return {
    atomName,
    bFactor: parseNumber(line.slice(60, 66)),
    chainId: line.slice(21, 22).trim() || " ",
    element: line.slice(76, 78).trim() || getAtomElement(atomName),
    insertionCode: line.slice(26, 27).trim() || " ",
    isHetAtom: recordType === "HETATM",
    residueName: line.slice(17, 20).trim(),
    residueNumber: parseInteger(line.slice(22, 26)) ?? 0,
    serial: parseInteger(line.slice(6, 11)),
    x,
    y,
    z,
  };
}

function buildResidueChains(atoms: PdbAtom[]) {
  const chains = new Map<string, PdbResidue[]>();
  const residueByKey = new Map<string, PdbResidue>();

  for (const atom of atoms) {
    if (atom.isHetAtom && !isResidueChainAtom(atom.residueName)) {
      continue;
    }

    const key = getResidueKey(atom);
    const existing = residueByKey.get(key);
    if (existing != null) {
      if (atom.serial != null) {
        existing.atomSerials.push(atom.serial);
      }
      continue;
    }

    const residues = chains.get(atom.chainId) ?? [];
    const residue: PdbResidue = {
      atomSerials: atom.serial == null ? [] : [atom.serial],
      chainId: atom.chainId,
      insertionCode: atom.insertionCode,
      residueName: atom.residueName,
      residueNumber: atom.residueNumber,
      sequenceCode: getResidueSequenceCode(atom.residueName),
    };
    residues.push(residue);
    residueByKey.set(key, residue);
    chains.set(atom.chainId, residues);
  }

  return [...chains.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([chainId, residues]) => ({
      chainId,
      residues,
      sequence: residues.map((residue) => residue.sequenceCode).join(""),
    }));
}

function pickTraceAtoms(atoms: PdbAtom[]) {
  const trace = atoms.filter((atom) => atom.atomName === "CA");
  return trace.length > 0 ? trace : atoms;
}

function buildStats(atoms: PdbAtom[], trace: PdbAtom[]): PdbStats {
  const residueCount = new Set(atoms.map((atom) => [atom.chainId, atom.residueName, atom.residueNumber, atom.insertionCode].join(":"))).size;
  const scores = (trace.length > 0 ? trace : atoms).map((atom) => atom.bFactor).filter((score): score is number => score != null);

  return {
    atomCount: atoms.length,
    chainCount: new Set(atoms.map((atom) => atom.chainId)).size,
    maxScore: scores.length > 0 ? Math.max(...scores) : null,
    meanScore:
      scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    minScore: scores.length > 0 ? Math.min(...scores) : null,
    residueCount,
  };
}

function getResidueKey(atom: PdbAtom) {
  return [atom.chainId, atom.residueNumber, atom.insertionCode, atom.residueName].join(":");
}

function getAtomElement(atomName: string) {
  return atomName.match(/[A-Za-z]+/)?.[0]?.slice(0, 2).toUpperCase() ?? "";
}

function isResidueChainAtom(residueName: string) {
  return RESIDUE_SEQUENCE_CODES[residueName.toUpperCase()] != null;
}

function getResidueSequenceCode(residueName: string) {
  return RESIDUE_SEQUENCE_CODES[residueName.toUpperCase()] ?? "X";
}

function getRemarkTitle(lines: string[]) {
  for (const line of lines) {
    if (line.slice(0, 6).trim() === "REMARK") {
      return parseRemark(line);
    }
  }
  return null;
}

function parseRemark(line: string) {
  const remark = line.slice(6).trim();
  return remark.length > 0 ? remark : null;
}

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string) {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}
