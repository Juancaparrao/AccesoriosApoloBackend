const usuariosPendientes = new Map(); // clave: correo, valor: datos del formulario

function guardarUsuarioPendiente(correo, datos) {
  usuariosPendientes.set(correo, datos);
}

function obtenerUsuarioPendiente(correo) {
  return usuariosPendientes.get(correo);
}

function eliminarUsuarioPendiente(correo) {
  usuariosPendientes.delete(correo);
}

module.exports = { guardarUsuarioPendiente, obtenerUsuarioPendiente, eliminarUsuarioPendiente };
