// Por qué no se puede importar un archivo. La interfaz traduce cada código.
export type BackupFileErrorCode =
  | "empty"
  | "too-large"
  | "unreadable"
  | "not-a-backup"
  | "csv-columns"
  | "csv-no-rows";

export class BackupFileError extends Error {
  readonly code: BackupFileErrorCode;

  constructor(code: BackupFileErrorCode) {
    super(`Backup file error: ${code}`);
    this.name = "BackupFileError";
    this.code = code;
  }
}
