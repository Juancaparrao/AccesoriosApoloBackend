function generarHtmlRecuperarContrasena(link) {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f2f2f2; padding: 40px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
        
        <div style="text-align: center;">
          <img src="https://i.imgur.com/vf6Lg64.png" alt="Logo Accesorios Apolo" style="max-width: 120px; margin-bottom: 20px;" />
        </div>

        <h2 style="color: #333333; text-align: center;">Recuperación de contraseña</h2>

        <p style="font-size: 16px; color: #555555; text-align: center;">
          Recibimos una solicitud para cambiar la contraseña de tu cuenta en <strong>Accesorios Apolo</strong>.
        </p>

        <p style="font-size: 16px; color: #555555; text-align: center;">
          Haz clic en el siguiente botón para establecer una nueva contraseña:
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #0077cc; color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 16px;">
            Cambiar contraseña
          </a>
        </div>

        <p style="font-size: 14px; color: #888888; text-align: center;">
          Este enlace es válido por 15 minutos. Si no solicitaste este cambio, puedes ignorar este correo.
        </p>

        <hr style="margin: 40px 0; border: none; border-top: 1px solid #eeeeee;" />

        <p style="text-align: center; font-size: 12px; color: #aaaaaa;">
          ¿Tienes dudas? Contáctanos en <a href="mailto:tiendaaccesoriosapolo@gmail.com">tiendaaccesoriosapolo@gmail.com</a>.
        </p>
      </div>
    </div>
  `;
}

module.exports = generarHtmlRecuperarContrasena;
