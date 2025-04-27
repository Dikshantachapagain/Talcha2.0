/**
 * Analyzes password strength and returns a score from 0-100
 * @param {string} password - The password to analyze
 * @returns {object} - Object containing score and feedback
 */
const analyzePasswordStrength = (password) => {
    if (!password) return { score: 0, feedback: 'Password is empty' };
    
    const length = password.length;
    let score = 0;
    let feedback = [];
  
    // Length check
    if (length < 8) {
      feedback.push('Password is too short (minimum 8 characters)');
    } else if (length >= 16) {
      score += 25;
      feedback.push('Good password length');
    } else {
      score += 15;
    }
  
    // Complexity checks
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSymbols = /[^A-Za-z0-9]/.test(password);
    
    if (hasUppercase) score += 10;
    if (hasLowercase) score += 10;
    if (hasNumbers) score += 10;
    if (hasSymbols) score += 15;
    
    if (!hasUppercase) feedback.push('Add uppercase letters');
    if (!hasLowercase) feedback.push('Add lowercase letters');
    if (!hasNumbers) feedback.push('Add numbers');
    if (!hasSymbols) feedback.push('Add special characters');
  
    // Check for common patterns
    const hasSequentialChars = /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789|890/i.test(password);
    const hasRepeatedChars = /(.)\1{2,}/i.test(password);
    
    if (hasSequentialChars) {
      score -= 10;
      feedback.push('Avoid sequential characters');
    }
    
    if (hasRepeatedChars) {
      score -= 10;
      feedback.push('Avoid repeated characters');
    }
  
    // Normalize score between 0-100
    score = Math.max(0, Math.min(100, score));
    
    // Determine strength category
    let strengthCategory;
    if (score < 30) {
      strengthCategory = 'Very Weak';
    } else if (score < 50) {
      strengthCategory = 'Weak';
    } else if (score < 70) {
      strengthCategory = 'Moderate';
    } else if (score < 90) {
      strengthCategory = 'Strong';
    } else {
      strengthCategory = 'Very Strong';
    }
    
    // If no feedback, provide positive reinforcement
    if (feedback.length === 0) {
      feedback.push('Excellent password!');
    }
    
    return {
      score,
      strengthCategory,
      feedback
    };
  };
  
  module.exports = {
    analyzePasswordStrength
  };