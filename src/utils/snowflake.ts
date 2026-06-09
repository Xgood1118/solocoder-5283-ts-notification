export class SnowflakeIdGenerator {
  private machineId: number;
  private sequence: number = 0;
  private lastTimestamp: number = -1;

  private static readonly MACHINE_ID_BITS = 10;
  private static readonly SEQUENCE_BITS = 12;
  private static readonly MAX_MACHINE_ID = (1 << SnowflakeIdGenerator.MACHINE_ID_BITS) - 1;
  private static readonly MAX_SEQUENCE = (1 << SnowflakeIdGenerator.SEQUENCE_BITS) - 1;

  constructor(machineId: number = 1) {
    if (machineId < 0 || machineId > SnowflakeIdGenerator.MAX_MACHINE_ID) {
      throw new Error(`Machine ID must be between 0 and ${SnowflakeIdGenerator.MAX_MACHINE_ID}`);
    }
    this.machineId = machineId;
  }

  generate(): string {
    let timestamp = Date.now();

    if (timestamp < this.lastTimestamp) {
      throw new Error('Clock moved backwards. Refusing to generate id');
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) & SnowflakeIdGenerator.MAX_SEQUENCE;
      if (this.sequence === 0) {
        timestamp = this.waitUntilNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    const id = (BigInt(timestamp) << BigInt(SnowflakeIdGenerator.MACHINE_ID_BITS + SnowflakeIdGenerator.SEQUENCE_BITS)) |
               (BigInt(this.machineId) << BigInt(SnowflakeIdGenerator.SEQUENCE_BITS)) |
               BigInt(this.sequence);

    return id.toString();
  }

  private waitUntilNextMillis(lastTimestamp: number): number {
    let timestamp = Date.now();
    while (timestamp <= lastTimestamp) {
      timestamp = Date.now();
    }
    return timestamp;
  }

  parse(id: string): { timestamp: number; machineId: number; sequence: number } {
    const bigId = BigInt(id);
    const timestamp = Number(bigId >> BigInt(SnowflakeIdGenerator.MACHINE_ID_BITS + SnowflakeIdGenerator.SEQUENCE_BITS));
    const machineId = Number((bigId >> BigInt(SnowflakeIdGenerator.SEQUENCE_BITS)) & BigInt(SnowflakeIdGenerator.MAX_MACHINE_ID));
    const sequence = Number(bigId & BigInt(SnowflakeIdGenerator.MAX_SEQUENCE));
    return { timestamp, machineId, sequence };
  }
}

const defaultGenerator = new SnowflakeIdGenerator(1);

export function generateSnowflakeId(): string {
  return defaultGenerator.generate();
}

export default SnowflakeIdGenerator;
