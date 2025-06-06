function generarHtmlOTP(codigo) {
  return `<div style="font-family: Arial, sans-serif; background: #f2f2f2; padding: 40px;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <div style="text-align: center;">
          <img src="https://i.imgur.com/vf6Lg64.png" alt="Logo Accesorios Apolo" style="max-width: 120px; margin-bottom: 20px;" />
        </div>
        <h2 style="color: #333; text-align: center;">Verificación de correo electrónico</h2>
        <p style="font-size: 16px; color: #555; text-align: center;">
          ¡Gracias por registrarte en <strong>Accesorios Apolo</strong>!
        </p>
        <p style="font-size: 16px; color: #555; text-align: center;">
          Ingresa el siguiente código para verificar tu dirección de correo:
        </p>
        <div style="background: #f0f8ff; font-size: 28px; font-weight: bold; color: #0077cc; text-align: center; padding: 15px 0; margin: 30px 0; border-radius: 8px;">
          ${codigo}
        </div>
        <p style="font-size: 14px; color: #888; text-align: center;">
          Este código expirará en 5 minutos.
        </p>
        <hr style="margin: 40px 0; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #aaa; text-align: center;">
          Si no solicitaste este código, puedes ignorar este correo.
        </p>
      </div>
    </div>`;
}

function generarHtmlBienvenida(nombre) {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f2f2f2; padding: 40px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
        
        <div style="text-align: center;">
          <img src="https://i.imgur.com/vf6Lg64.png" alt="Logo Accesorios Apolo" style="max-width: 120px; margin-bottom: 20px;" />
        </div>

        <h2 style="color: #333333; text-align: center;">¡Bienvenido, ${nombre}!</h2>

        <p style="font-size: 16px; color: #555555; text-align: center;">
          Nos alegra tenerte con nosotros. Gracias por registrarte en <strong>Accesorios Apolo</strong>, tu tienda confiable de accesorios de calidad.
        </p>

        <div style="margin: 30px 0; text-align: center;">
          <p style="font-size: 16px; color: #0077cc;">A partir de ahora podrás:</p>
          <ul style="list-style: none; padding: 0; color: #555555; font-size: 15px;">
            <li>✓ Acceder a promociones exclusivas</li>
            <li>✓ Realizar compras más rápido</li>
            <li>✓ Hacer seguimiento a tus pedidos</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 40px;">
          <a href="https://accesorios-apolo-frontend.vercel.app/" style="background-color: #0077cc; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-size: 16px;">
            Visita nuestra tienda
          </a>
        </div>

        <hr style="margin: 40px 0; border: none; border-top: 1px solid #eeeeee;" />

        <p style="text-align: center; font-size: 12px; color: #aaaaaa;">
          Este es un mensaje automático de bienvenida. Si tienes preguntas, contáctanos en 
          <a href="mailto:soporte@accesoriosapolo.com">soporte@accesoriosapolo.com</a>.
        </p>

      </div>
    </div>
  `;
}

module.exports = {
  generarHtmlOTP,
  generarHtmlBienvenida
};