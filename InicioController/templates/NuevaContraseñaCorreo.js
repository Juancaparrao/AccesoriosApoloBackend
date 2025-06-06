function NuevaContraseñaCorreo(nombre, correo, contrasenaParaEnviar) {
  return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Actualización de Usuario</h2>
              <p>Hola <strong>${nombre}</strong>,</p>
              <p>Tu usuario ha sido actualizado exitosamente. A continuación encontrarás tu información de acceso:</p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Correo:</strong> ${correo}</p>
                <p><strong>Contraseña:</strong> ${contrasenaParaEnviar}</p>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Por seguridad, te recomendamos cambiar tu contraseña después del primer inicio de sesión.
              </p>
              
              <p>Saludos,<br>El equipo de administración</p>
            </div>
          `;
}

module.exports = NuevaContraseñaCorreo;