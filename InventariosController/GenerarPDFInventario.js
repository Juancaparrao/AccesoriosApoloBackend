const pool = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function GenerarPDFInventario(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID del inventario es requerido'
      });
    }

    // Obtener datos del inventario principal (que ahora incluye conteo de calcomanías)
    const [inventario] = await pool.execute(`
      SELECT
        id_inventario,
        fecha_creacion,
        cantidad_productos,
        cantidad_unidades,
        cantidad_calcomanias,        
        cantidad_unidades_calcomanias, 
        valor_total,
        responsable
      FROM inventario
      WHERE id_inventario = ?
    `, [id]);

    if (inventario.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Inventario no encontrado'
      });
    }

    // Obtener detalles de PRODUCTOS del inventario
    const [detallesProductos] = await pool.execute(`
      SELECT
        di.id_detalle,
        di.FK_referencia_producto AS referencia,
        p.nombre,
        p.descripcion,
        p.marca,
        p.talla,
        c.nombre_categoria,
        sc.nombre_subcategoria,
        di.cantidad,
        di.precio_unitario,
        di.subtotal,
        di.stock_general -- Para productos, este es el stock total
      FROM detalle_inventario di
      JOIN producto p ON di.FK_referencia_producto = p.referencia
      LEFT JOIN categoria c ON p.FK_id_categoria = c.id_categoria
      LEFT JOIN subcategoria sc ON p.FK_id_subcategoria = sc.id_subcategoria
      WHERE di.FK_id_inventario = ? AND di.FK_referencia_producto IS NOT NULL
      ORDER BY p.nombre
    `, [id]);

    // Obtener detalles de CALCOMANÍAS del inventario
    const [detallesCalcomanias] = await pool.execute(`
      SELECT
        di.id_detalle,
        di.FK_id_calcomania AS id_calcomania,
        cal.nombre,
        di.cantidad, -- Es el stock_general combinado de la calcomanía
        di.precio_unitario,
        di.subtotal,
        di.stock_pequeno,
        di.stock_mediano,
        di.stock_grande,
        di.stock_general
      FROM detalle_inventario di
      JOIN calcomania cal ON di.FK_id_calcomania = cal.id_calcomania
      WHERE di.FK_id_inventario = ? AND di.FK_id_calcomania IS NOT NULL
      ORDER BY cal.nombre
    `, [id]);


    // Crear el documento PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Configurar la respuesta HTTP para mostrar en el navegador
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=inventario_${id}_${new Date().toISOString().split('T')[0]}.pdf`);

    // Enviar el PDF directamente al cliente
    doc.pipe(res);

    const inventarioData = inventario[0];
    const fechaFormateada = new Date(inventarioData.fecha_creacion).toLocaleDateString('es-CO');
    const valorTotalFormateado = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(inventarioData.valor_total);

    // Función para formatear números
    const formatearNumero = (valor) => {
      return new Intl.NumberFormat('es-CO').format(Number(valor));
    };

    // Función para formatear moneda
    const formatearMoneda = (valor) => {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(valor);
    };

    // ENCABEZADO
    doc.fontSize(20).font('Helvetica-Bold').text('ACCESORIOS APOLO', 50, 50);
    doc.fontSize(16).font('Helvetica-Bold').text('REPORTE DE INVENTARIO', 50, 80);

    // Línea separadora
    doc.moveTo(50, 110).lineTo(550, 110).stroke();

    // INFORMACIÓN DEL INVENTARIO
    let yPosition = 130;
    doc.fontSize(12).font('Helvetica-Bold').text('INFORMACIÓN GENERAL', 50, yPosition);
    yPosition += 25;

    doc.fontSize(10).font('Helvetica');
    doc.text(`ID Inventario: ${inventarioData.id_inventario}`, 50, yPosition);
    doc.text(`Fecha: ${fechaFormateada}`, 300, yPosition);
    yPosition += 15;

    doc.text(`Responsable: ${inventarioData.responsable}`, 50, yPosition);
    doc.text(`Total Productos (ítems): ${formatearNumero(inventarioData.cantidad_productos)}`, 300, yPosition);
    yPosition += 15;

    doc.text(`Total Unidades Productos: ${formatearNumero(inventarioData.cantidad_unidades)}`, 50, yPosition);
    doc.text(`Total Calcomanías (ítems): ${formatearNumero(inventarioData.cantidad_calcomanias)}`, 300, yPosition);
    yPosition += 15;

    doc.text(`Total Unidades Calcomanías: ${formatearNumero(inventarioData.cantidad_unidades_calcomanias)}`, 50, yPosition);
    doc.text(`Valor Total Inventario: ${valorTotalFormateado}`, 300, yPosition);
    yPosition += 30;

    // --- TABLA DE PRODUCTOS ---
    if (detallesProductos.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('DETALLE DE PRODUCTOS', 50, yPosition);
      yPosition += 20;

      // Encabezados de la tabla de productos
      const productTableHeaders = [
        { text: 'REF', x: 50, width: 50 },
        { text: 'PRODUCTO', x: 105, width: 120 },
        { text: 'CATEGORÍA', x: 230, width: 80 },
        { text: 'MARCA', x: 315, width: 60 },
        { text: 'CANT', x: 380, width: 40 },
        { text: 'PRECIO', x: 425, width: 60 },
        { text: 'SUBTOTAL', x: 490, width: 60 }
      ];

      doc.fontSize(9).font('Helvetica-Bold');
      productTableHeaders.forEach(header => {
        doc.text(header.text, header.x, yPosition);
      });

      // Línea bajo encabezados
      yPosition += 15;
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 5;

      // Datos de los productos
      doc.fontSize(8).font('Helvetica');
      detallesProductos.forEach((detalle, index) => {
        // Verificar si necesitamos una nueva página antes de dibujar la fila
        if (yPosition + 12 > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          yPosition = doc.page.margins.top;

          // Repetir encabezados en nueva página
          doc.fontSize(9).font('Helvetica-Bold');
          productTableHeaders.forEach(header => {
            doc.text(header.text, header.x, yPosition);
          });
          yPosition += 15;
          doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
          yPosition += 5;
          doc.fontSize(8).font('Helvetica');
        }

        const rowData = [
          { text: detalle.referencia.substring(0, 8), x: 50 },
          { text: detalle.nombre.substring(0, 18), x: 105 },
          { text: (detalle.nombre_categoria || 'N/A').substring(0, 12), x: 230 },
          { text: (detalle.marca || 'N/A').substring(0, 10), x: 315 },
          { text: detalle.cantidad.toString(), x: 380 },
          { text: formatearMoneda(detalle.precio_unitario).replace('COP', '$'), x: 425 },
          { text: formatearMoneda(detalle.subtotal).replace('COP', '$'), x: 490 }
        ];

        rowData.forEach(cell => {
          doc.text(cell.text, cell.x, yPosition);
        });

        yPosition += 12;

        // Línea separadora cada 5 filas
        if ((index + 1) % 5 === 0) {
          doc.moveTo(50, yPosition).lineTo(550, yPosition).strokeOpacity(0.3).stroke().strokeOpacity(1);
          yPosition += 3;
        }
      });
      yPosition += 15; // Espacio después de la tabla de productos
    } else {
        doc.fontSize(10).font('Helvetica').text('No hay productos registrados en este inventario.', 50, yPosition);
        yPosition += 20;
    }


    // --- TABLA DE CALCOMANÍAS ---
    if (detallesCalcomanias.length > 0) {
      // Verificar si necesitamos una nueva página antes de la tabla de calcomanías
      if (yPosition + 50 > doc.page.height - doc.page.margins.bottom) { // 50 para el título y encabezados
          doc.addPage();
          yPosition = doc.page.margins.top;
      }

      doc.fontSize(12).font('Helvetica-Bold').text('DETALLE DE CALCOMANÍAS', 50, yPosition);
      yPosition += 20;

      // Encabezados de la tabla de calcomanías
      const calcomaniaTableHeaders = [
        { text: 'ID', x: 50, width: 40 },
        { text: 'NOMBRE', x: 95, width: 100 },
        { text: 'STOCK PEQ.', x: 200, width: 60 },
        { text: 'STOCK MED.', x: 265, width: 60 },
        { text: 'STOCK GDE.', x: 330, width: 60 },
        { text: 'TOTAL UNID.', x: 395, width: 60 },
        { text: 'PRECIO', x: 460, width: 40 },
        { text: 'SUBTOTAL', x: 525, width: 70 }
      ];

      doc.fontSize(9).font('Helvetica-Bold');
      calcomaniaTableHeaders.forEach(header => {
        doc.text(header.text, header.x, yPosition);
      });

      // Línea bajo encabezados
      yPosition += 15;
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 5;

      // Datos de las calcomanías
      doc.fontSize(8).font('Helvetica');
      detallesCalcomanias.forEach((detalle, index) => {
        // Verificar si necesitamos una nueva página antes de dibujar la fila
        if (yPosition + 12 > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          yPosition = doc.page.margins.top;

          // Repetir encabezados en nueva página
          doc.fontSize(9).font('Helvetica-Bold');
          calcomaniaTableHeaders.forEach(header => {
            doc.text(header.text, header.x, yPosition);
          });
          yPosition += 15;
          doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
          yPosition += 5;
          doc.fontSize(8).font('Helvetica');
        }

        const rowData = [
          { text: detalle.id_calcomania.toString(), x: 50 },
          { text: detalle.nombre.substring(0, 15), x: 95 },
          { text: detalle.stock_pequeno.toString(), x: 200 },
          { text: detalle.stock_mediano.toString(), x: 265 },
          { text: detalle.stock_grande.toString(), x: 330 },
          { text: detalle.stock_general.toString(), x: 395 },
          { text: formatearMoneda(detalle.precio_unitario).replace('COP', '$'), x: 460 },
          { text: formatearMoneda(detalle.subtotal).replace('COP', '$'), x: 525 }
        ];

        rowData.forEach(cell => {
          doc.text(cell.text, cell.x, yPosition);
        });

        yPosition += 12;

        // Línea separadora cada 5 filas
        if ((index + 1) % 5 === 0) {
          doc.moveTo(50, yPosition).lineTo(550, yPosition).strokeOpacity(0.3).stroke().strokeOpacity(1);
          yPosition += 3;
        }
      });
      yPosition += 15; // Espacio después de la tabla de calcomanías
    } else {
        // Si no hay calcomanías, añadir un mensaje solo si no había productos antes, o si ya hay espacio.
        if (yPosition + 20 > doc.page.height - doc.page.margins.bottom) {
             doc.addPage();
             yPosition = doc.page.margins.top;
        }
        doc.fontSize(10).font('Helvetica').text('No hay calcomanías registradas en este inventario.', 50, yPosition);
        yPosition += 20;
    }


    // RESUMEN FINAL
    yPosition += 15;
    // Asegurarse de que el resumen quepa en la página actual o crear una nueva
    if (yPosition + 80 > doc.page.height - doc.page.margins.bottom) { // Aproximadamente 80 de espacio para el resumen
        doc.addPage();
        yPosition = doc.page.margins.top;
    }

    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 10;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('RESUMEN GENERAL DEL INVENTARIO', 50, yPosition);
    yPosition += 20;

    doc.fontSize(9).font('Helvetica');
    doc.text(`Total de ítems (productos + calcomanías): ${formatearNumero(inventarioData.cantidad_productos + inventarioData.cantidad_calcomanias)}`, 50, yPosition);
    yPosition += 12;
    doc.text(`Total de unidades (productos + calcomanías): ${formatearNumero(inventarioData.cantidad_unidades + inventarioData.cantidad_unidades_calcomanias)}`, 50, yPosition);
    yPosition += 12;
    doc.text(`Valor total del inventario: ${valorTotalFormateado}`, 50, yPosition);


    // PIE DE PÁGINA
    // Asegurarse de que el pie de página quepa
    if (yPosition + 40 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        yPosition = doc.page.margins.top;
    } else {
        yPosition += 40;
    }
    doc.fontSize(8).font('Helvetica');

    // Fecha y hora de Colombia
    const fechaHoraColombia = new Date().toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    doc.text(`Generado el: ${fechaHoraColombia}`, 50, yPosition);
    doc.text('Accesorios Apolo - Sistema de Inventarios', 350, yPosition);

    // Finalizar el documento
    doc.end();

  } catch (error) {
    console.error('❌ Error al generar PDF del inventario:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        mensaje: 'Error al generar el PDF del inventario.'
      });
    }
  }
}

module.exports = { GenerarPDFInventario };
