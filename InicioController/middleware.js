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

function verificarTokenOpcional(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Obtiene el token de "Bearer TOKEN"

    if (token == null) {
        // No hay token. No es un error para esta ruta, solo significa usuario no autenticado.
        req.user = null; // Establece req.user a null para indicar que no hay usuario autenticado.
        return next(); // <--- Continúa la ejecución
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            // Token inválido/expirado. No es un error para esta ruta, solo significa usuario no autenticado.
            console.log("Token inválido/expirado en ruta opcional, procediendo como usuario no autenticado.");
            req.user = null; // Establece req.user a null.
            return next(); // <--- Continúa la ejecución
        }
        // Token válido, adjuntamos la información del usuario
        req.user = user; // 'user' contendrá la carga útil del JWT (ej. { id_usuario: ..., correo: ... })
        next(); // <--- Continúa la ejecución
    });
}


module.exports = { verificarToken, verificarTokenOpcional };