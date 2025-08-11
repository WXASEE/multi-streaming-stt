type Slot = 'A' | 'B' | 'C' | 'D' | 'E';
const SLOT_LABELS: Slot[] = ['A','B','C','D','E'];

export class SpeakerMapper {
  private maxSlots: number | 'auto' = 'auto';
  private map = new Map<string, Slot>();      // raw -> slot
  private order: string[] = [];               // Order of addition
  private lastSlot: Slot | null = null;

  constructor(expected: number | 'auto' | '2' | '3' = 'auto') {
    this.maxSlots = expected === 'auto' ? 'auto' : Number(expected);
  }

  setMaxSlots(n: number | 'auto' | '2' | '3') {
    this.maxSlots = n === 'auto' ? 'auto' : Number(n);
  }

  reset() {
    this.map.clear();
    this.order = [];
    this.lastSlot = null;
  }

  // Convert rawLabel: "S0" / "spk_0" / number etc. to UI-friendly "A", "B", "C"
  mapLabel(raw: string | number): Slot {
    const key = String(raw).replace(/^spk_/, 'S');
    const hit = this.map.get(key);
    if (hit) { this.lastSlot = hit; return hit; }

    const limit = this.maxSlots === 'auto' ? Infinity : this.maxSlots;
    if (this.map.size < limit) {
      const slot = SLOT_LABELS[this.map.size] ?? 'E';
      this.map.set(key, slot);
      this.order.push(key);
      this.lastSlot = slot;
      return slot;
    }
    // When exceeded: Simple heuristics - absorb into previous slot
    if (this.lastSlot) return this.lastSlot;

    // Fallback: Absorb into first slot
    const firstKey = this.order[0];
    const slot = firstKey ? (this.map.get(firstKey) as Slot) : 'A';
    this.map.set(key, slot);
    this.lastSlot = slot;
    return slot;
  }
}