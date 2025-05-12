// This goes in encryption.js
const crypto = require('crypto');

/**
 * Encrypts data using AES-256-CBC
 * @param {string} text - Text to encrypt
 * @param {string} masterKeyOrDerivedKey - Either a raw master password or a derived key (SHA-256 hash)
 * @returns {string} - Encrypted data in format: iv:encryptedData
 */
const encrypt = (text, masterKeyOrDerivedKey) => {
  try {
    // Check if the input is already a derived key (SHA-256 hash in hex format is 64 characters)
    let key;
    if (masterKeyOrDerivedKey && masterKeyOrDerivedKey.length === 64 && /^[0-9a-f]+$/i.test(masterKeyOrDerivedKey)) {
      // It's already a derived key in hex format, convert to Buffer
      key = Buffer.from(masterKeyOrDerivedKey, 'hex');
    } else {
      // It's a raw password, create a key by hashing it
      key = crypto.createHash('sha256').update(masterKeyOrDerivedKey).digest();
    }
    
    // Generates a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Creates cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // Encrypts the data
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Returns IV and encrypted data
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypts data encrypted with AES-256-CBC
 * @param {string} encryptedData - Encrypted data in format: iv:encryptedData
 * @param {string} masterKeyOrDerivedKey - Either a raw master password or a derived key (SHA-256 hash)
 * @returns {string} - Decrypted data
 */
const decrypt = (encryptedData, masterKeyOrDerivedKey) => {
  try {
    // Check if the input is already a derived key (SHA-256 hash in hex format is 64 characters)
    let key;
    if (masterKeyOrDerivedKey && masterKeyOrDerivedKey.length === 64 && /^[0-9a-f]+$/i.test(masterKeyOrDerivedKey)) {
      // It's already a derived key in hex format, convert to Buffer
      key = Buffer.from(masterKeyOrDerivedKey, 'hex');
    } else {
      // It's a raw password, create a key by hashing it
      key = crypto.createHash('sha256').update(masterKeyOrDerivedKey).digest();
    }
    
    // Splits the IV and encrypted data
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    // Creates decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    // Decrypts the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

module.exports = {
  encrypt,
  decrypt
};