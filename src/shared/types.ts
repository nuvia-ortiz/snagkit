export type Lang = "en" | "es";

export type ConsoleEntry = {
  t: number;
  level: "error" | "warn";
  message: string;
  source?: string;
};

export type NetworkEntry = {
  t: number;
  method: string;
  url: string;
  /** Código HTTP; 0 si la petición no llegó a completarse. */
  status: number;
  error?: string;
  type: string;
};

/** Elemento sobre el que actúa el usuario, descrito como lo leería una persona. */
export type Target = { role: string; label: string };

export type Step =
  | { t: number; kind: "navigate"; url: string }
  | { t: number; kind: "click"; target: Target }
  | { t: number; kind: "type"; target: Target }
  | { t: number; kind: "select"; target: Target; value: string }
  | { t: number; kind: "check"; target: Target; checked: boolean }
  | { t: number; kind: "submit"; target: Target }
  | { t: number; kind: "key"; key: string; target: Target };

export type TabSession = {
  console: ConsoleEntry[];
  network: NetworkEntry[];
  steps: Step[];
};

export type Environment = {
  url: string;
  title: string;
  userAgent: string;
  browser: string;
  os: string;
  language: string;
  viewport: string;
  screen: string;
  pixelRatio: number;
  timestamp: string;
};

export type Rect = { x: number; y: number; w: number; h: number };

/** Datos que otro módulo (p. ej. el probador de formularios) deja ya escritos en el reporte. */
export type Prefill = { title: string; description: string; severity: Severity; steps?: string; expected?: string };

export type ReportDraft = {
  id: string;
  createdAt: number;
  screenshot: string;
  env: Environment;
  session: TabSession;
  prefill?: Prefill;
  /** Zona a recuadrar en la captura, en píxeles de la imagen. */
  highlight?: Rect;
};

export type Severity = "critical" | "high" | "medium" | "low";

/** Lo que la persona escribe en el formulario del informe. */
export type ReportForm = {
  title: string;
  severity: Severity;
  description: string;
  expected: string;
  steps: string;
  include: { env: boolean; console: boolean; network: boolean };
};

/** Mensajes que viajan entre las partes de la extensión. */
export type Message =
  | { type: "console"; entry: ConsoleEntry }
  | { type: "step"; step: Step }
  | { type: "getSession"; tabId: number }
  | { type: "clearSession"; tabId: number }
  | { type: "createReport"; tabId: number; windowId: number }
  | { type: "setRecording"; on: boolean }
  | { type: "reportFromPage"; prefill: Prefill; highlight?: Rect }
  | { type: "runFormTester"; tabId: number }
  | { type: "runStressTest"; tabId: number };

export const LIMITS = { console: 50, network: 50, steps: 30 } as const;
