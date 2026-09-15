export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
};

export type Paginated<T> = {
  data: T[];
  meta: PageMeta;
};

/** Lo que sobrevive a `JSON.stringify`: las fechas viajan como ISO string. */
export type Serialized<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
};
