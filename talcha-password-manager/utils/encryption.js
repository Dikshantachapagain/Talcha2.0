const crypto = require('crypto');

/**
 * Encrypts data using AES-256-CBC
 * @param {string} text - Text to encrypt
 * @param {string} masterKey - Master key for encryption (derived from user's master password)
 * @returns {string} - Encrypted data in format: iv:encryptedData
 */
const encrypt = (text, masterKey) => {
  try {
    // Creates a key from the master key using SHA-256
    const key = crypto.createHash('sha256').update(masterKey).digest();
    
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
 * @param {string} masterKey - Master key for decryption (derived from user's master password)
 * @returns {string} - Decrypted data
 */
const decrypt = (encryptedData, masterKey) => {
  try {
    // Creates a key from the master key using SHA-256
    const key = crypto.createHash('sha256').update(masterKey).digest();
    
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