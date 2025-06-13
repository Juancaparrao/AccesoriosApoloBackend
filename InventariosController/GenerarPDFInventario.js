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

    // Obtener datos del inventario principal
    const [inventario] = await pool.execute(`
      SELECT 
        id_inventario,
        fecha_creacion,
        cantidad_productos,
        cantidad_unidades,
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

    // Obtener detalles del inventario con información de productos
    const [detalles] = await pool.execute(`
      SELECT 
        di.id_detalle,
        di.FK_referencia_producto as referencia,
        p.nombre,
        p.descripcion,
        p.marca,
        p.talla,
        c.nombre_categoria,
        sc.nombre_subcategoria,
        di.cantidad,
        di.precio_unitario,
        di.subtotal
      FROM detalle_inventario di
      JOIN producto p ON di.FK_referencia_producto = p.referencia
      LEFT JOIN categoria c ON p.FK_id_categoria = c.id_categoria
      LEFT JOIN subcategoria sc ON p.FK_id_subcategoria = sc.id_subcategoria
      WHERE di.FK_id_inventario = ?
      ORDER BY p.nombre
    `, [id]);

    // Crear el documento PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Configurar la respuesta HTTP
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=inventario_${id}_${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Enviar el PDF directamente al cliente
    doc.pipe(res);

    const inventarioData = inventario[0];
    const fechaFormateada = new Date(inventarioData.fecha_creacion).toLocaleDateString('es-CO');
    const valorFormateado = new Intl.NumberFormat('es-CO', {
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
        currency: 'COP'
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
    doc.text(`Productos: ${formatearNumero(inventarioData.cantidad_productos)}`, 300, yPosition);
    yPosition += 15;

    doc.text(`Total Unidades: ${formatearNumero(inventarioData.cantidad_unidades)}`, 50, yPosition);
    doc.text(`Valor Total: ${valorFormateado}`, 300, yPosition);
    yPosition += 30;

    // TABLA DE PRODUCTOS
    doc.fontSize(12).font('Helvetica-Bold').text('DETALLE DE PRODUCTOS', 50, yPosition);
    yPosition += 20;

    // Encabezados de la tabla
    const tableTop = yPosition;
    const tableHeaders = [
      { text: 'REF', x: 50, width: 50 },
      { text: 'PRODUCTO', x: 105, width: 120 },
      { text: 'CATEGORÍA', x: 230, width: 80 },
      { text: 'MARCA', x: 315, width: 60 },
      { text: 'CANT', x: 380, width: 40 },
      { text: 'PRECIO', x: 425, width: 60 },
      { text: 'SUBTOTAL', x: 490, width: 60 }
    ];

    doc.fontSize(9).font('Helvetica-Bold');
    tableHeaders.forEach(header => {
      doc.text(header.text, header.x, tableTop);
    });

    // Línea bajo encabezados
    yPosition = tableTop + 15;
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 5;

    // Datos de los productos
    doc.fontSize(8).font('Helvetica');
    let totalGeneral = 0;

    detalles.forEach((detalle, index) => {
      // Verificar si necesitamos una nueva página
      if (yPosition > 720) {
        doc.addPage();
        yPosition = 50;
        
        // Repetir encabezados en nueva página
        doc.fontSize(9).font('Helvetica-Bold');
        tableHeaders.forEach(header => {
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

      totalGeneral += parseFloat(detalle.subtotal);
      yPosition += 12;

      // Línea separadora cada 5 filas
      if ((index + 1) % 5 === 0) {
        doc.moveTo(50, yPosition).lineTo(550, yPosition).strokeOpacity(0.3).stroke().strokeOpacity(1);
        yPosition += 3;
      }
    });

    // RESUMEN FINAL
    yPosition += 15;
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 10;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('RESUMEN FINAL', 50, yPosition);
    yPosition += 20;

    doc.fontSize(9).font('Helvetica');
    doc.text(`Total de productos diferentes: ${formatearNumero(detalles.length)}`, 50, yPosition);
    yPosition += 12;
    doc.text(`Total de unidades: ${formatearNumero(inventarioData.cantidad_unidades)}`, 50, yPosition);
    yPosition += 12;
    doc.text(`Valor total del inventario: ${formatearMoneda(totalGeneral)}`, 50, yPosition);

    // PIE DE PÁGINA
    yPosition += 40;
    doc.fontSize(8).font('Helvetica');
    doc.text(`Generado el: ${new Date().toLocaleString('es-CO')}`, 50, yPosition);
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