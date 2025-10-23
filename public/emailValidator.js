// Email validation function
function validateEmail(email) {
    // Simpler but effective regex for email validation
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

    // Basic validation checks
    if (!email || email.trim().length === 0) {
        return { isValid: false, error: "Email is required" };
    }

    if (!emailRegex.test(email)) {
        return { isValid: false, error: "Please enter a valid email address" };
    }

    // Check for common invalid patterns
    if (email.includes('..')) {
        return { isValid: false, error: "Email cannot contain consecutive dots" };
    }

    if (email.split('@').length > 2) {
        return { isValid: false, error: "Email cannot contain multiple @ symbols" };
    }

    const [localPart, domain] = email.split('@');
    
    if (localPart.length > 64) {
        return { isValid: false, error: "Local part of email cannot exceed 64 characters" };
    }

    if (domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) {
        return { isValid: false, error: "Invalid domain format" };
    }

    const domainParts = domain.split('.');
    if (domainParts.length < 2) {
        return { isValid: false, error: "Domain must have at least one dot" };
    }

    if (domainParts[domainParts.length - 1].length < 2) {
        return { isValid: false, error: "Top-level domain must be at least 2 characters" };
    }

    if (email.length > 254) {
        return { isValid: false, error: "Email address is too long" };
    }

    return { isValid: true };
}