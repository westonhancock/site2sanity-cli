/**
 * Logging utilities with chalk and ora
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';

export class Logger {
  private spinner: Ora | null = null;

  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  error(message: string): void {
    console.log(chalk.red('✗'), message);
  }

  warn(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.gray('▸'), message);
    }
  }

  startSpinner(message: string): void {
    this.spinner = ora(message).start();
  }

  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  succeedSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  failSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  table(data: Array<Record<string, any>>): void {
    if (data.length === 0) return;

    const keys = Object.keys(data[0]);
    const widths = keys.map(key =>
      Math.max(key.length, ...data.map(row => String(row[key] || '').length))
    );

    // Header
    console.log();
    console.log(
      keys.map((key, i) => chalk.bold(key.padEnd(widths[i]))).join('  ')
    );
    console.log(keys.map((_, i) => '─'.repeat(widths[i])).join('  '));

    // Rows
    data.forEach(row => {
      console.log(
        keys.map((key, i) => String(row[key] || '').padEnd(widths[i])).join('  ')
      );
    });
    console.log();
  }

  section(title: string): void {
    console.log();
    console.log(chalk.bold.cyan(`━━━ ${title} ━━━`));
    console.log();
  }

  json(data: any): void {
    console.log(JSON.stringify(data, null, 2));
  }
}

export const logger = new Logger();
