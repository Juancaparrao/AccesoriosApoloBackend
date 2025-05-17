const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ mensaje: 'Token requerido' });

  const token = authHeader.split(' ')[1]; // Separa "Bearer" y "<token>"

  if (!token) return res.status(403).json({ mensaje: 'Token no proporcionado' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ mensaje: 'Token inválido' });
  }
}


module.exports = { verificarToken };