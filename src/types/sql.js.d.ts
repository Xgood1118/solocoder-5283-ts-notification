declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface Statement {
    run(...params: any[]): Statement;
    getAsObject(...params: any[]): any;
    get(...params: any[]): any[];
    all(...params: any[]): any[][];
    step(): boolean;
    free(): boolean;
    reset(): void;
    columnNames: string[];
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: any[]): Database;
    exec(sql: string, params?: any[]): any[];
    prepare(sql: string): Statement;
    each(sql: string, params: any[], callback: (row: any) => void, done: () => void): Database;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
    create_function(name: string, func: (...args: any[]) => any): Database;
    create_aggregate(name: string, functions: { init?: () => any; step: (state: any, ...values: any[]) => any; finalize: (state: any) => any }): Database;
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
