module.exports = (app) => 
  app.Num = (t) => 
    isNaN(t) ? 0 : new Intl.NumberFormat("en-GB",{
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
      maximumSignificantDigits: 4
    }).format(t);