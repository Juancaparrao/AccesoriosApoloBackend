const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root', // o el usuario que uses
  password: 'mzf2casa18', // tu contraseña, si tienes
  database: 'Accesorios_Apolo',
});

module.exports = pool; 

