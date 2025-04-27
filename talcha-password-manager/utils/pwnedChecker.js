const crypto = require('crypto');
const axios = require('axios');

/**
 * Checks if a password has been compromised using the Have I Been Pwned API
 * Uses k-anonymity model to protect the full password from being sent
 * @param {string} password - The password to check
 * @returns {object} - Results of the check
 */
const checkPasswordCompromised = async (password) => {
  try {
    // Generate SHA-1 hash of the password
    const sha1Hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    console.log('Generated SHA-1 hash for password');
    
    // Get the first 5 characters of the hash (prefix)
    const prefix = sha1Hash.substring(0, 5);
    
    // Get the remainder of the hash
    const suffix = sha1Hash.substring(5);
    
    console.log(`Checking HIBP API with prefix: ${prefix}`);
    
    // Calls the HIBP API with just the prefix (k-anonymity model)
    const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'Talcha-Password-Manager',
        'Accept': 'application/json',
        'hibp-api-key': process.env.HIBP_API_KEY || '' // Optional API key 
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log('Received response from HIBP API');
    
    // Parse the response to check if our suffix is in the list
    const hashes = response.data.split('\r\n');
    console.log(`Received ${hashes.length} hash suffixes to check against`);
    
    for (const hash of hashes) {
      const [returnedSuffix, count] = hash.split(':');
      
      if (returnedSuffix === suffix) {
        console.log(`Match found! Password compromised in ${count} breaches`);
        return {
          compromised: true,
          count: parseInt(count, 10),
          message: `This password has been found in ${count} data breaches. It is strongly recommended to change it.`
        };
      }
    }
    
    console.log('No match found. Password not compromised.');
    // Password not found in breaches
    return {
      compromised: false,
      count: 0,
      message: 'This password has not been found in known data breaches.'
    };
    
  } catch (error) {
    console.error('Error checking HIBP API:', error);
    
    // More detailed error handling
    let errorMessage = 'Unable to check if password has been compromised.';
    
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorMessage = 'Unable to connect to the Have I Been Pwned API. Please check your internet connection.';
    } else if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      errorMessage = `HIBP API error: ${error.response.status} - ${error.response.statusText}`;
    }
    
    return {
      error: true,
      compromised: false, // Default to false on error
      message: errorMessage,
      details: error.message
    };
  }
};

module.exports = {
  checkPasswordCompromised
};