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

    // Extra safeguard: reject suspicious provider + extra-TLD patterns like "gmail.com.us"
    // Common providers that shouldn't appear as a third-level domain followed by 'com' (e.g. gmail.com.us)
    const suspiciousProviders = ['gmail', 'yahoo', 'hotmail', 'outlook', 'live', 'icloud', 'aol', 'protonmail', 'gmx', 'mail'];
    const lowerDomain = domain.toLowerCase();
    const parts = lowerDomain.split('.');
    if (parts.length >= 3) {
        const thirdLevel = parts[parts.length - 3];
        const secondLevel = parts[parts.length - 2];
        // If pattern is provider.com.X (e.g. gmail.com.us), reject it as likely abuse/mistyped
        if (suspiciousProviders.includes(thirdLevel) && secondLevel === 'com') {
            return { isValid: false, error: "Invalid or suspicious email domain" };
        }
    }

    return { isValid: true };
}