function generarHtmlRecuperarContrasena(link) {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f2f2f2; padding: 40px;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
      
      <div style="text-align: center;">
        <img src="https://i.imgur.com/vf6Lg64.png" alt="Logo Accesorios Apolo" style="max-width: 120px; margin-bottom: 20px;" />
      </div>

      <h2 style="color: #333333; text-align: center;">Actualización de Usuario</h2>

      <p style="font-size: 16px; color: #555555; text-align: center;">
        Hola <strong>${nombre}</strong>, tu usuario ha sido actualizado exitosamente. A continuación encontrarás tu información de acceso:
      </p>

      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 30px 0; font-size: 16px; color: #333;">
        <p><strong>Correo:</strong> ${correo}</p>
        <p><strong>Contraseña:</strong> ${contrasenaParaEnviar}</p>
      </div>

      <p style="font-size: 14px; color: #888888; text-align: center;">
        Por seguridad, te recomendamos cambiar tu contraseña después del primer inicio de sesión.
      </p>

      <hr style="margin: 40px 0; border: none; border-top: 1px solid #eeeeee;" />

      <p style="text-align: center; font-size: 12px; color: #aaaaaa;">
        ¿Tienes dudas? Contáctanos en <a href="mailto:soporte@accesoriosapolo.com">soporte@accesoriosapolo.com</a>.
      </p>
    </div>
  </div>
  `;
}

module.exports = generarHtmlRecuperarContrasena;
