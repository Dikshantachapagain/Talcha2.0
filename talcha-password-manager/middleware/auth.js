// Middleware to check if user is authenticated
exports.isAuthenticated = (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }
    next();
  };
  
  // Middleware to check if user is not authenticated
  exports.isNotAuthenticated = (req, res, next) => {
    if (req.session.user) {
      return res.redirect('/passwords/dashboard');
    }
    next();
  };
  
  // Middleware to ensure master key is available
  exports.hasMasterKey = (req, res, next) => {
    if (!req.session.user || !req.session.user.masterKey) {
      // If user is logged in but master key is missing, log them out
      if (req.session.user) {
        req.session.destroy();
      }
      return res.redirect('/auth/login');
    }
    next();
  };
  
//extension
  //API authentiction middleware for the chrome extension
  exports.isAuthenticatedAPI = (req,res,next)=>{
    if (!req.session.user){
      return res.status(401).json({success:false, message:'Authentication required'});
    }
    next();
  };

  //API master key middleware for the chrome extension
  exports.hashMasterKeyApi = (req,res,next) => {
    if (!req.session.user || !req.session.user.masterKey){
      return res.status(401).json ({success:false, message:'Authentication required' });
    }
    next();
  };