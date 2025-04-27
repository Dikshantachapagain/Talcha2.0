/**
 * Generates a secure random password
 * @param {number} length - Password length
 * @param {boolean} includeUppercase - Include uppercase letters
 * @param {boolean} includeLowercase - Include lowercase letters
 * @param {boolean} includeNumbers - Include numbers
 * @param {boolean} includeSymbols - Include special symbols
 * @returns {string} - Generated password
 */
const generatePassword = (
    length = 16,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true
  ) => {
    // Define character sets
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    // Create character pool based on options
    let charPool = '';
    if (includeUppercase) charPool += uppercaseChars;
    if (includeLowercase) charPool += lowercaseChars;
    if (includeNumbers) charPool += numberChars;
    if (includeSymbols) charPool += symbolChars;
    
    // If no character sets were selected, default to lowercase
    if (charPool === '') charPool = lowercaseChars;
    
    // Generate password
    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charPool.length);
      password += charPool[randomIndex];
    }
    
    // Ensure at least one character from each selected character set
    let finalPassword = password;
    if (includeUppercase) {
      const randomUppercase = uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)];
      const randomPosition = Math.floor(Math.random() * finalPassword.length);
      finalPassword = finalPassword.substring(0, randomPosition) + randomUppercase + finalPassword.substring(randomPosition + 1);
    }
    
    if (includeLowercase) {
      const randomLowercase = lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)];
      const randomPosition = Math.floor(Math.random() * finalPassword.length);
      finalPassword = finalPassword.substring(0, randomPosition) + randomLowercase + finalPassword.substring(randomPosition + 1);
    }
    
    if (includeNumbers) {
      const randomNumber = numberChars[Math.floor(Math.random() * numberChars.length)];
      const randomPosition = Math.floor(Math.random() * finalPassword.length);
      finalPassword = finalPassword.substring(0, randomPosition) + randomNumber + finalPassword.substring(randomPosition + 1);
    }
    
    if (includeSymbols) {
      const randomSymbol = symbolChars[Math.floor(Math.random() * symbolChars.length)];
      const randomPosition = Math.floor(Math.random() * finalPassword.length);
      finalPassword = finalPassword.substring(0, randomPosition) + randomSymbol + finalPassword.substring(randomPosition + 1);
    }
    
    return finalPassword;
  };
  
  module.exports = {
    generatePassword
  };