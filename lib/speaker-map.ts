type Slot = 'A' | 'B' | 'C' | 'D' | 'E';
const SLOT_LABELS: Slot[] = ['A','B','C','D','E'];

export class SpeakerMapper {
  constructor(private maxSlots: number | 'auto' = 'auto') {}
  private map = new Map<string, Slot>();      // raw -> slot
  private order: string[] = [];               // 追加順
  private lastSlot: Slot | null = null;

  setMaxSlots(n: number | 'auto') {
    this.maxSlots = n;
  }

  reset() {
    this.map.clear();
    this.order = [];
    this.lastSlot = null;
  }

  // rawLabel: "S0" / "spk_0" / number 等を受け取り、UI向けの "A","B","C" にする
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
    // 超過時：簡易ヒューリスティクス → 直前スロットに吸収
    if (this.lastSlot) return this.lastSlot;

    // フォールバック：先頭に吸収
    const firstKey = this.order[0];
    const slot = firstKey ? (this.map.get(firstKey) as Slot) : 'A';
    this.map.set(key, slot);
    this.lastSlot = slot;
    return slot;
  }
}