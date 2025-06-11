const transporter = require('../config/mailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generarPDFFactura(datosFactura) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const nombreArchivo = `factura_${datosFactura.id_factura}_${Date.now()}.pdf`;
      const rutaArchivo = path.join(__dirname, '../temp/', nombreArchivo);

      if (!fs.existsSync(path.dirname(rutaArchivo))) {
        fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });
      }

      const stream = fs.createWriteStream(rutaArchivo);
      doc.pipe(stream);

      doc.fontSize(20).fillColor('#2c3e50').text('ACCESORIOS APOLO', 50, 50);
      doc.fontSize(12).fillColor('#7f8c8d')
        .text('NIT: 123.456.789-0', 50, 75)
        .text('Dirección: Calle 123 #45-67', 50, 90)
        .text('Teléfono: (601) 234-5678', 50, 105)
        .text('Email: info@accesoriosapolo.com', 50, 120);
      doc.moveTo(50, 140).lineTo(550, 140).stroke('#bdc3c7');

      doc.fontSize(16).fillColor('#2c3e50').text('FACTURA DE VENTA', 50, 160);
      doc.fontSize(12).fillColor('#34495e')
        .text(`Factura No: ${datosFactura.id_factura}`, 50, 190)
        .text(`Fecha: ${datosFactura.fecha_venta}`, 50, 205)
        .text(`Método de Pago: ${datosFactura.metodo_pago}`, 50, 220);

      doc.fontSize(14).fillColor('#2c3e50').text('DATOS DEL CLIENTE', 50, 250);
      doc.fontSize(11).fillColor('#34495e')
        .text(`Cédula: ${datosFactura.cliente.cedula}`, 50, 275)
        .text(`Nombre: ${datosFactura.cliente.nombre}`, 50, 290)
        .text(`Teléfono: ${datosFactura.cliente.telefono}`, 50, 305)
        .text(`Correo: ${datosFactura.cliente.correo}`, 50, 320);

      doc.fontSize(14).fillColor('#2c3e50').text('PRODUCTOS VENDIDOS', 50, 350);
      const inicioTabla = 380;
      doc.fontSize(10).fillColor('#2c3e50')
        .text('REF.', 50, inicioTabla)
        .text('PRODUCTO', 100, inicioTabla)
        .text('CANT.', 300, inicioTabla)
        .text('PRECIO UNIT.', 350, inicioTabla)
        .text('SUBTOTAL', 450, inicioTabla);
      doc.moveTo(50, inicioTabla + 15).lineTo(550, inicioTabla + 15).stroke('#bdc3c7');

      let posicionY = inicioTabla + 25;
      datosFactura.productos.forEach(producto => {
        doc.fontSize(9).fillColor('#34495e')
          .text(producto.referencia, 50, posicionY)
          .text(producto.nombre.substring(0, 25) + (producto.nombre.length > 25 ? '...' : ''), 100, posicionY)
          .text(producto.cantidad.toString(), 300, posicionY)
          .text(`$${producto.precio_unitario}`, 350, posicionY)
          .text(`$${producto.subtotal}`, 450, posicionY);
        if (producto.tiene_descuento) {
          doc.fontSize(8).fillColor('#e74c3c')
            .text(`(Precio original: $${producto.precio_original})`, 350, posicionY + 12);
        }
        posicionY += producto.tiene_descuento ? 30 : 20;
        if (posicionY > 700) {
          doc.addPage();
          posicionY = 50;
        }
      });

      doc.moveTo(50, posicionY + 10).lineTo(550, posicionY + 10).stroke('#bdc3c7');
      doc.fontSize(14).fillColor('#2c3e50').text('VALOR TOTAL:', 350, posicionY + 25);
      doc.fontSize(16).fillColor('#27ae60').text(`$${datosFactura.valor_total}`, 450, posicionY + 25);
      doc.fontSize(10).fillColor('#7f8c8d')
        .text(`Total de productos: ${datosFactura.total_productos}`, 50, posicionY + 60)
        .text('Gracias por su compra en Accesorios Apolo', 50, posicionY + 80)
        .text('Para soporte técnico: soporte@accesoriosapolo.com', 50, posicionY + 95);
      doc.fontSize(8).fillColor('#95a5a6')
        .text('Este documento es una factura de venta generada electrónicamente.', 50, posicionY + 120)
        .text(`Generado el: ${new Date().toLocaleString('es-CO')}`, 50, posicionY + 135);
      doc.end();

      stream.on('finish', () => resolve(rutaArchivo));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

async function enviarFacturaPorCorreo(emailDestino, datosFactura) {
  try {
    const rutaPDF = await generarPDFFactura(datosFactura);

    const opcionesCorreo = {
      from: { name: 'Accesorios Apolo', address: process.env.EMAIL_USER },
      to: emailDestino,
      subject: `Factura de Compra #${datosFactura.id_factura} - Accesorios Apolo`,
      html: `<p>Estimado/a ${datosFactura.cliente.nombre}, gracias por su compra. Adjuntamos su factura.</p>`,
      attachments: [
        {
          filename: `Factura_${datosFactura.id_factura}.pdf`,
          path: rutaPDF,
          contentType: 'application/pdf'
        }
      ]
    };

    const resultado = await transporter.sendMail(opcionesCorreo);
    console.log('✅ Correo enviado:', resultado.messageId);

    setTimeout(() => {
      if (fs.existsSync(rutaPDF)) {
        fs.unlinkSync(rutaPDF);
        console.log('🗑️ Archivo temporal eliminado:', rutaPDF);
      }
    }, 3000);

    return { success: true, message: 'Correo enviado exitosamente' };
  } catch (error) {
    console.error('❌ Error al enviar correo:', error);
    throw new Error(`Error al enviar correo: ${error.message}`);
  }
}

module.exports = {
  enviarFacturaPorCorreo
};