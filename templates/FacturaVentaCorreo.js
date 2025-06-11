const transporter = require('../config/mailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');


// Función para generar PDF de la factura
function generarPDFFactura(datosFactura) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const nombreArchivo = `factura_${datosFactura.id_factura}_${Date.now()}.pdf`;
      const rutaArchivo = path.join(__dirname, '../temp/', nombreArchivo);

      // Crear directorio temp si no existe
      const tempDir = path.dirname(rutaArchivo);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const stream = fs.createWriteStream(rutaArchivo);
      doc.pipe(stream);

      // Encabezado de la empresa
      doc.fontSize(20)
         .fillColor('#2c3e50')
         .text('ACCESORIOS APOLO', 50, 50);
      
      doc.fontSize(12)
         .fillColor('#7f8c8d')
         .text('NIT: 123.456.789-0', 50, 75)
         .text('Dirección: Calle 123 #45-67', 50, 90)
         .text('Teléfono: (601) 234-5678', 50, 105)
         .text('Email: info@accesoriosapolo.com', 50, 120);

      // Línea separadora
      doc.moveTo(50, 140)
         .lineTo(550, 140)
         .stroke('#bdc3c7');

      // Título de la factura
      doc.fontSize(16)
         .fillColor('#2c3e50')
         .text('FACTURA DE VENTA', 50, 160);

      // Información de la factura
      doc.fontSize(12)
         .fillColor('#34495e')
         .text(`Factura No: ${datosFactura.id_factura}`, 50, 190)
         .text(`Fecha: ${datosFactura.fecha_venta}`, 50, 205)
         .text(`Método de Pago: ${datosFactura.metodo_pago}`, 50, 220);

      // Información del cliente
      doc.fontSize(14)
         .fillColor('#2c3e50')
         .text('DATOS DEL CLIENTE', 50, 250);
      
      doc.fontSize(11)
         .fillColor('#34495e')
         .text(`Cédula: ${datosFactura.cliente.cedula}`, 50, 275)
         .text(`Nombre: ${datosFactura.cliente.nombre}`, 50, 290)
         .text(`Teléfono: ${datosFactura.cliente.telefono}`, 50, 305)
         .text(`Correo: ${datosFactura.cliente.correo}`, 50, 320);

      // Tabla de productos
      doc.fontSize(14)
         .fillColor('#2c3e50')
         .text('PRODUCTOS VENDIDOS', 50, 350);

      // Encabezados de la tabla
      const inicioTabla = 380;
      doc.fontSize(10)
         .fillColor('#2c3e50')
         .text('REF.', 50, inicioTabla)
         .text('PRODUCTO', 100, inicioTabla)
         .text('CANT.', 300, inicioTabla)
         .text('PRECIO UNIT.', 350, inicioTabla)
         .text('SUBTOTAL', 450, inicioTabla);

      // Línea bajo encabezados
      doc.moveTo(50, inicioTabla + 15)
         .lineTo(550, inicioTabla + 15)
         .stroke('#bdc3c7');

      // Productos
      let posicionY = inicioTabla + 25;
      let totalGeneral = 0;

      datosFactura.productos.forEach((producto, index) => {
        doc.fontSize(9)
           .fillColor('#34495e')
           .text(producto.referencia, 50, posicionY)
           .text(producto.nombre.substring(0, 25) + (producto.nombre.length > 25 ? '...' : ''), 100, posicionY)
           .text(producto.cantidad.toString(), 300, posicionY)
           .text(`$${producto.precio_unitario}`, 350, posicionY)
           .text(`$${producto.subtotal}`, 450, posicionY);

        // Si tiene descuento, mostrar precio original tachado
        if (producto.tiene_descuento) {
          doc.fontSize(8)
             .fillColor('#e74c3c')
             .text(`(Precio original: $${producto.precio_original})`, 350, posicionY + 12);
        }

        posicionY += producto.tiene_descuento ? 30 : 20;

        // Salto de página si es necesario
        if (posicionY > 700) {
          doc.addPage();
          posicionY = 50;
        }
      });

      // Línea antes del total
      doc.moveTo(50, posicionY + 10)
         .lineTo(550, posicionY + 10)
         .stroke('#bdc3c7');

      // Total
      doc.fontSize(14)
         .fillColor('#2c3e50')
         .text('VALOR TOTAL:', 350, posicionY + 25)
         .fontSize(16)
         .fillColor('#27ae60')
         .text(`$${datosFactura.valor_total}`, 450, posicionY + 25);

      // Información adicional
      doc.fontSize(10)
         .fillColor('#7f8c8d')
         .text(`Total de productos: ${datosFactura.total_productos}`, 50, posicionY + 60)
         .text('Gracias por su compra en Accesorios Apolo', 50, posicionY + 80)
         .text('Para soporte técnico: soporte@accesoriosapolo.com', 50, posicionY + 95);

      // Pie de página
      doc.fontSize(8)
         .fillColor('#95a5a6')
         .text('Este documento es una factura de venta generada electrónicamente.', 50, posicionY + 120)
         .text(`Generado el: ${new Date().toLocaleString('es-CO')}`, 50, posicionY + 135);

      doc.end();

      stream.on('finish', function () {
        resolve(rutaArchivo);
      });

      stream.on('error', function (err) {
        reject(err);
      });

    } catch (error) {
      reject(error);
    }
  });
}

// Función para enviar correo con PDF de factura
async function enviarFacturaPorCorreo(emailDestino, datosFactura) {
  try {
    console.log('📧 Generando PDF de factura...');
    
    // Generar el PDF
    const rutaPDF = await generarPDFFactura(datosFactura);
    
    console.log('📄 PDF generado exitosamente:', rutaPDF);

    // Configurar el correo
    const opcionesCorreo = {
      from: {
        name: 'Accesorios Apolo',
        address: process.env.EMAIL_USER
      },
      to: emailDestino,
      subject: `Factura de Compra #${datosFactura.id_factura} - Accesorios Apolo`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin: 0;">ACCESORIOS APOLO</h1>
            <p style="color: #7f8c8d; margin: 5px 0;">Tu tienda de accesorios de confianza</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin-top: 0;">¡Gracias por tu compra!</h2>
            <p style="color: #34495e; margin: 10px 0;">Estimado/a <strong>${datosFactura.cliente.nombre}</strong>,</p>
            <p style="color: #34495e; margin: 10px 0;">
              Nos complace confirmar que hemos procesado exitosamente tu compra. 
              En el archivo adjunto encontrarás la factura detallada de tu pedido.
            </p>
          </div>

          <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="color: #2c3e50; margin-top: 0;">Resumen de la Compra</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #7f8c8d;"><strong>Factura No:</strong></td>
                <td style="padding: 8px 0; color: #2c3e50;">${datosFactura.id_factura}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #7f8c8d;"><strong>Fecha:</strong></td>
                <td style="padding: 8px 0; color: #2c3e50;">${datosFactura.fecha_venta}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #7f8c8d;"><strong>Método de Pago:</strong></td>
                <td style="padding: 8px 0; color: #2c3e50;">${datosFactura.metodo_pago}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #7f8c8d;"><strong>Total de Productos:</strong></td>
                <td style="padding: 8px 0; color: #2c3e50;">${datosFactura.total_productos}</td>
              </tr>
              <tr style="border-top: 2px solid #27ae60;">
                <td style="padding: 12px 0; color: #27ae60;"><strong>VALOR TOTAL:</strong></td>
                <td style="padding: 12px 0; color: #27ae60; font-size: 18px;"><strong>$${datosFactura.valor_total}</strong></td>
              </tr>
            </table>
          </div>

          <div style="background-color: #e8f5e8; border-left: 4px solid #27ae60; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0; color: #2c3e50;">
              <strong>📎 Factura Adjunta:</strong> Hemos incluido tu factura en formato PDF para tus registros.
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 20px;">
            <p style="color: #7f8c8d; margin: 5px 0;">¿Necesitas ayuda? Contáctanos:</p>
            <p style="color: #2c3e50; margin: 5px 0;">
              📞 (601) 234-5678 | 📧 soporte@accesoriosapolo.com
            </p>
          </div>

          <div style="border-top: 1px solid #e9ecef; padding-top: 20px; text-align: center;">
            <p style="color: #95a5a6; font-size: 12px; margin: 0;">
              Este correo fue enviado automáticamente, por favor no respondas a esta dirección.
            </p>
            <p style="color: #95a5a6; font-size: 12px; margin: 5px 0;">
              © ${new Date().getFullYear()} Accesorios Apolo. Todos los derechos reservados.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Factura_${datosFactura.id_factura}.pdf`,
          path: rutaPDF,
          contentType: 'application/pdf'
        }
      ]
    };

    // Enviar el correo
    console.log('📤 Enviando correo...');
    const resultado = await transporter.sendMail(opcionesCorreo);
    
    console.log('✅ Correo enviado exitosamente:', resultado.messageId);

    // Eliminar el archivo temporal después de enviar
    setTimeout(() => {
      if (fs.existsSync(rutaPDF)) {
        fs.unlinkSync(rutaPDF);
        console.log('🗑️ Archivo temporal eliminado:', rutaPDF);
      }
    }, 5000); // Esperar 5 segundos antes de eliminar

    return {
      success: true,
      messageId: resultado.messageId,
      mensaje: 'Correo enviado exitosamente'
    };

  } catch (error) {
    console.error('❌ Error al enviar correo:', error);
    throw new Error(`Error al enviar correo: ${error.message}`);
  }
}



module.exports = {
  enviarFacturaPorCorreo,
};