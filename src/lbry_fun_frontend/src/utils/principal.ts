export function principalToString(principalId: string | undefined | null): string {
    if (!principalId) {
        return "";
    }
    const parts = principalId.split('-');
    if (parts.length < 3) {
        return principalId; // Not in expected format, return as is
    }
    // Show first group, ellipsis, last group
    return `${parts[0]}...${parts[parts.length - 1]}`;
} 