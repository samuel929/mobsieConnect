export function branchReferencePrefix(branchName: string) {
  const value = branchName.toLowerCase();
  if (value.includes("hebron")) return "H1";
  if (value.includes("mamelodi")) return "M1";
  if (value.includes("soshanguve")) return "S1";
  if (value.includes("thembisa") || value.includes("tembisa")) return "T1";
  if (value.includes("sky")) return "SC1";
  if (value.includes("soweto")) return "S2";
  return branchName.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "APP";
}

export function childInitials(childName: string) {
  const initials = childName
    .trim()
    .split(/[\s-]+/)
    .map((part) => part.replace(/[^a-z0-9]/gi, "").charAt(0))
    .join("")
    .toUpperCase();
  return initials || "XX";
}

export function birthDateReference(dateOfBirth: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
  if (!match) throw new Error("A valid child date of birth is required to create the reference.");
  return `${match[3]}${match[2]}${match[1].slice(-2)}`;
}

export function applicationReference(branchName: string, childName: string, dateOfBirth: string) {
  return `${branchReferencePrefix(branchName)}${childInitials(childName)}${birthDateReference(dateOfBirth)}`;
}

export function nextAvailableReference(base: string, references: string[]) {
  const existing = new Set(references);
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
