function generarHtmlContrasena(nombre, contrasena) {
  return `<div style="font-family: Arial, sans-serif; background: #f2f2f2; padding: 40px;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <div style="text-align: center;">
          <img src="https://i.imgur.com/vf6Lg64.png" alt="Logo Accesorios Apolo" style="max-width: 120px; margin-bottom: 20px;" />
        </div>
        <h2 style="color: #333; text-align: center;">¡Bienvenido a Accesorios Apolo!</h2>
        <p style="font-size: 16px; color: #555; text-align: center;">
          ¡Hola <strong>${nombre}</strong>! Tu cuenta ha sido creada exitosamente.
        </p>
        <p style="font-size: 16px; color: #555; text-align: center;">
          Hemos generado una contraseña temporal para tu cuenta:
        </p>
        <div style="background: #f0f8ff; font-size: 24px; font-weight: bold; color: #0077cc; text-align: center; padding: 15px 0; margin: 30px 0; border-radius: 8px; letter-spacing: 2px;">
          ${contrasena}
        </div>
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="font-size: 14px; color: #856404; margin: 0; text-align: center;">
            <strong>⚠️ Importante:</strong> Te recomendamos cambiar esta contraseña después de tu primer inicio de sesión por seguridad.
          </p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://accesorios-apolo-frontend.vercel.app/login" style="background-color: #0077cc; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-size: 16px;">
            Iniciar Sesión
          </a>
        </div>
        <hr style="margin: 40px 0; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #aaa; text-align: center;">
          Si no solicitaste esta cuenta, puedes ignorar este correo o contactarnos.
        </p>
      </div>
    </div>`;
}

module.exports = {generarHtmlContrasena} ;