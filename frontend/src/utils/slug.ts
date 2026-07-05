export function toSlug(value: string): string {
  return (value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export default toSlug;

type EquipmentSlugInput = {
  id: string;
  nickname?: string | null;
  unit_number?: string | null;
};

// Nicknames are no longer unique (e.g. five "Bau-Man Conveyor" units), so
// equipment URLs include the unit number when there is one.
export function equipmentSlug(item: EquipmentSlugInput): string {
  const parts = [
    item.unit_number ? `unit-${item.unit_number}` : null,
    item.nickname?.trim() || item.id,
  ].filter(Boolean) as string[];
  return toSlug(parts.join(' '));
}
