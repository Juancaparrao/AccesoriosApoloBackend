const pool = require('../db');
const emailService = require('../templates/FacturaVentaCorreo'); // Importar el servicio de correo

// Controlador para validar cliente por cédula (SIN CAMBIOS)
async function ValidarClientePorCedula(req, res) {
    try {
        const { cedula } = req.query;

        if (!cedula) {
            return res.status(400).json({
                success: false,
                mensaje: 'La cédula del cliente es requerida'
            });
        }

        const [cliente] = await pool.execute(
            'SELECT id_usuario, cedula, nombre, correo, telefono, estado FROM usuario WHERE cedula = ?',
            [cedula]
        );

        if (cliente.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'La cédula no está registrada en el sistema'
            });
        }

        // Verificar si el cliente está activo
        if (!cliente[0].estado) {
            return res.status(403).json({
                success: false,
                mensaje: 'El usuario está inactivo'
            });
        }

        return res.status(200).json({
            success: true,
            cliente: {
                id_usuario: cliente[0].id_usuario,
                cedula: cliente[0].cedula,
                nombre: cliente[0].nombre,
                correo: cliente[0].correo,
                telefono: cliente[0].telefono
            }
        });

    } catch (error) {
        console.error('Error al validar cliente:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error interno al validar el cliente'
        });
    }
}

// Controlador para buscar producto por referencia (para ventas) (MODIFICADO LEVE)
// Asegura que `descuento` sea el porcentaje y `precio_descuento` el precio final
async function BuscarProductoVentaPorReferencia(req, res) {
    try {
        const { referencia } = req.query;

        if (!referencia) {
            return res.status(400).json({
                success: false,
                mensaje: 'La referencia del producto es requerida'
            });
        }

        const [producto] = await pool.execute(
            `SELECT referencia, nombre, stock, precio_unidad, descuento, precio_descuento, estado
             FROM producto
             WHERE TRIM(referencia) = TRIM(?) AND estado = 1`,
            [referencia]
        );

        if (producto.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Producto no encontrado o inactivo'
            });
        }

        // Verificar si hay stock disponible
        if (producto[0].stock <= 0) {
            return res.status(400).json({
                success: false,
                mensaje: 'Producto sin stock disponible'
            });
        }

        const productoInfo = {
            referencia: producto[0].referencia,
            nombre: producto[0].nombre,
            stock: producto[0].stock,
            precio_unidad: parseFloat(producto[0].precio_unidad), // Precio original
            descuento_porcentaje: producto[0].descuento ? parseFloat(producto[0].descuento) : null, // Porcentaje de descuento
            precio_final_con_descuento: producto[0].precio_descuento ? parseFloat(producto[0].precio_descuento) : null // Precio final ya con descuento
        };

        return res.status(200).json({
            success: true,
            producto: productoInfo
        });

    } catch (error) {
        console.error('Error al buscar producto:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error interno al buscar el producto'
        });
    }
}

// Controlador para buscar calcomanía por ID (para ventas) (MODIFICADO SIGNIFICATIVAMENTE)
// Ahora `precio_descuento` de la DB es el precio final, y calculamos el porcentaje si es necesario.
async function BuscarCalcomaniaVentaPorId(req, res) {
    try {
        const { id, tamano, cantidad } = req.query;

        // Validaciones iniciales
        if (!id) {
            return res.status(400).json({
                success: false,
                mensaje: 'El ID de la calcomanía es requerido.'
            });
        }

        if (!tamano || !['pequeno', 'mediano', 'grande'].includes(tamano)) {
            return res.status(400).json({
                success: false,
                mensaje: 'El tamaño de la calcomanía (pequeno, mediano o grande) es requerido y debe ser válido.'
            });
        }

        if (isNaN(parseInt(cantidad)) || parseInt(cantidad) <= 0) {
            return res.status(400).json({
                success: false,
                mensaje: 'La cantidad debe ser un número entero positivo.'
            });
        }

        // Consulta la calcomanía en la base de datos
        const [calcomaniaRows] = await pool.execute(
            `SELECT
                id_calcomania,
                nombre,
                precio_unidad,
                precio_descuento, /* ESTE ES AHORA EL PRECIO FINAL CON DESCUENTO APLICADO */
                stock_pequeno,
                stock_mediano,
                stock_grande,
                estado
               FROM calcomania
               WHERE id_calcomania = ? AND estado = 1`,
            [id]
        );

        // Verifica si la calcomanía existe y está activa
        if (calcomaniaRows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Calcomanía no encontrada o inactiva.'
            });
        }

        const calcomania = calcomaniaRows[0];
        let precio_base_original_sin_descuento = parseFloat(calcomania.precio_unidad); // Precio base de la DB
        let stock_disponible;

        // Calcula el precio base POR TAMAÑO (antes de cualquier descuento)
        let precio_por_tamano = precio_base_original_sin_descuento; // Este será el "precio original" para este tamaño

        switch (tamano) {
            case 'pequeno':
                stock_disponible = calcomania.stock_pequeno;
                // precio_por_tamano se mantiene igual
                break;
            case 'mediano':
                precio_por_tamano += precio_base_original_sin_descuento * 1.25; // Se le suma el 125%
                stock_disponible = calcomania.stock_mediano;
                break;
            case 'grande':
                precio_por_tamano += precio_base_original_sin_descuento * 3.00; // Se le suma el 300%
                stock_disponible = calcomania.stock_grande;
                break;
        }

        // Verifica si hay suficiente stock para el tamaño y cantidad solicitada
        if (stock_disponible <= 0 || parseInt(cantidad) > stock_disponible) {
            return res.status(400).json({
                success: false,
                mensaje: `No hay suficiente stock disponible para el tamaño "${tamano}". Stock actual: ${stock_disponible}.`
            });
        }

        let precio_final_aplicado;
        let descuento_porcentaje_calculado = null;
        let tiene_descuento = false;

        // Si existe un precio_descuento en la DB para la calcomanía y es válido
        if (calcomania.precio_descuento !== null && parseFloat(calcomania.precio_descuento) > 0) {
            const precio_descuento_db = parseFloat(calcomania.precio_descuento);

            // Validar que el precio de descuento no sea mayor al precio_por_tamano
            if (precio_descuento_db < precio_por_tamano) {
                precio_final_aplicado = precio_descuento_db;
                tiene_descuento = true;
                // Calcular el porcentaje de descuento
                descuento_porcentaje_calculado = ((precio_por_tamano - precio_descuento_db) / precio_por_tamano) * 100;
            } else {
                // Si el precio de descuento de DB es mayor o igual al precio por tamaño, no hay descuento efectivo
                precio_final_aplicado = precio_por_tamano;
            }
        } else {
            // No hay precio de descuento en DB, usar el precio calculado por tamaño
            precio_final_aplicado = precio_por_tamano;
        }

        // Calcula el subtotal con el precio final aplicado
        const subtotal = precio_final_aplicado * parseInt(cantidad);

        // Prepara la información de la calcomanía para la respuesta
        const calcomaniaInfo = {
            id_calcomania: calcomania.id_calcomania,
            nombre: calcomania.nombre,
            // precio_original_por_tamano: Precio antes de aplicar el descuento de la DB, solo afectado por tamaño.
            precio_original_por_tamano: parseFloat(precio_por_tamano.toFixed(2)),
            // precio_final_con_descuento: El precio final que se usará para la venta (si hay descuento, será el de la DB, si no, será precio_original_por_tamano)
            precio_final_con_descuento: parseFloat(precio_final_aplicado.toFixed(2)),
            descuento_porcentaje_calculado: descuento_porcentaje_calculado ? parseFloat(descuento_porcentaje_calculado.toFixed(2)) : null,
            tiene_descuento: tiene_descuento,
            subtotal: parseFloat(subtotal.toFixed(2)) // Subtotal calculado
        };

        // Envía la respuesta exitosa
        return res.status(200).json({
            success: true,
            calcomania: calcomaniaInfo
        });

    } catch (error) {
        console.error('Error al buscar calcomanía:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error interno al buscar la calcomanía.'
        });
    }
}

async function RegistrarVenta(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            cedula_cliente,
            metodo_pago,
            fecha_venta, // Fecha que viene del frontend
            valor_total, // Valor total calculado por el frontend
            productos = [], // Array de productos: [{referencia, cantidad, precio_usado}, ...]
            calcomanias = [], // Array de calcomanias: [{id_calcomania, cantidad, tamano, precio_usado}, ...]
            enviar_correo = false // Boolean para saber si enviar correo con PDF
        } = req.body;

        // Validaciones básicas de campos obligatorios
        if (!cedula_cliente || !metodo_pago || valor_total === undefined || valor_total === null) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                mensaje: 'Faltan campos obligatorios: cédula del cliente, método de pago y valor total.'
            });
        }

        // Debe haber al menos un producto o una calcomanía
        if (productos.length === 0 && calcomanias.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                mensaje: 'Debe agregar al menos un producto o una calcomanía a la venta.'
            });
        }

        // Validar que el valor total sea positivo
        if (Number(valor_total) <= 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                mensaje: 'El valor total debe ser mayor a cero.'
            });
        }

        // Validar que el cliente existe y está activo
        const [cliente] = await connection.execute(
            'SELECT id_usuario, cedula, nombre, correo, telefono, estado FROM usuario WHERE cedula = ?',
            [cedula_cliente]
        );

        if (cliente.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                mensaje: 'El cliente no existe. Verifique la cédula ingresada.'
            });
        }

        if (!cliente[0].estado) {
            await connection.rollback();
            return res.status(403).json({
                success: false,
                mensaje: 'El cliente está inactivo.'
            });
        }

        // Generar ID único para la factura
        const [maxId] = await connection.execute(
            'SELECT COALESCE(MAX(id_factura), 0) + 1 as nuevo_id FROM factura'
        );
        const id_factura = maxId[0].nuevo_id;

        // --- Procesamiento y validación de Productos ---
        const productosValidados = [];
        const referenciasVistas = new Set();

        for (let i = 0; i < productos.length; i++) {
            const producto = productos[i];

            if (!producto.referencia || !producto.cantidad || producto.precio_usado === undefined || producto.precio_usado === null) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    mensaje: `El producto en la posición ${i + 1} debe tener referencia, cantidad y precio_usado.`
                });
            }

            const referenciaLimpia = String(producto.referencia).trim();

            if (referenciasVistas.has(referenciaLimpia)) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    mensaje: `La referencia ${referenciaLimpia} está duplicada en la venta de productos.`
                });
            }
            referenciasVistas.add(referenciaLimpia);

            if (Number(producto.cantidad) <= 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    mensaje: `La cantidad del producto ${referenciaLimpia} debe ser mayor a cero.`
                });
            }

            const [productoExistente] = await connection.execute(
                'SELECT referencia, nombre, stock, precio_unidad, descuento, precio_descuento, estado FROM producto WHERE TRIM(referencia) = TRIM(?)',
                [referenciaLimpia]
            );

            if (productoExistente.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    mensaje: `El producto con referencia ${referenciaLimpia} no existe.`
                });
            }

            if (!productoExistente[0].estado) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    mensaje: `El producto ${productoExistente[0].nombre} está inactivo.`
                });
            }

            if (productoExistente[0].stock < Number(producto.cantidad)) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    mensaje: `Stock insuficiente para el producto ${productoExistente[0].nombre}. Stock disponible: ${productoExistente[0].stock}, solicitado: ${producto.cantidad}`
                });
            }

            // **Validar y determinar precios para productos**
            let precio_original_producto = parseFloat(productoExistente[0].precio_unidad);
            let precio_esperado_bd_producto = precio_original_producto; // Por defecto, el precio sin descuento
            let tiene_descuento_producto = false;
            let porcentaje_descuento_producto = null;

            // Si hay un porcentaje de descuento en la DB y es válido
            if (productoExistente[0].descuento !== null && parseFloat(productoExistente[0].descuento) > 0 && parseFloat(productoExistente[0].descuento) <= 100) {
                porcentaje_descuento_producto = parseFloat(productoExistente[0].descuento);
                // Si también hay un precio_descuento (precio final), usaremos ese para la validación
                if (productoExistente[0].precio_descuento !== null && parseFloat(productoExistente[0].precio_descuento) > 0 && parseFloat(productoExistente[0].precio_descuento) < precio_original_producto) {
                    precio_esperado_bd_producto = parseFloat(productoExistente[0].precio_descuento);
                    tiene_descuento_producto = true;
                } else {
                    // Si el precio_descuento no es válido o no existe, calcularlo a partir del porcentaje
                    precio_esperado_bd_producto = precio_original_producto * (1 - (porcentaje_descuento_producto / 100));
                    tiene_descuento_producto = true;
                }
            } else if (productoExistente[0].precio_descuento !== null && parseFloat(productoExistente[0].precio_descuento) > 0 && parseFloat(productoExistente[0].precio_descuento) < precio_original_producto) {
                // Si no hay porcentaje pero sí un precio_descuento (precio final) válido
                precio_esperado_bd_producto = parseFloat(productoExistente[0].precio_descuento);
                tiene_descuento_producto = true;
                // Calcular el porcentaje de descuento si solo tenemos el precio_descuento
                porcentaje_descuento_producto = ((precio_original_producto - precio_esperado_bd_producto) / precio_original_producto) * 100;
            }


            // Tolerancia para la validación del precio del frontend
            if (Math.abs(parseFloat(producto.precio_usado) - precio_esperado_bd_producto) > 0.01) {
                console.warn(`Advertencia: Precio usado para ${referenciaLimpia} (${producto.precio_usado}) difiere del esperado en BD (${precio_esperado_bd_producto}).`);
                // Considera si quieres forzar el precio de BD aquí:
                // producto.precio_usado = precio_esperado_bd_producto;
            }

            productosValidados.push({
                referencia: referenciaLimpia,
                nombre: productoExistente[0].nombre,
                cantidad: Number(producto.cantidad),
                precio_unidad_base_original: precio_original_producto, // Precio sin descuento de la DB
                precio_usado: parseFloat(producto.precio_usado), // Precio final que se usará para la venta
                stock_disponible_bd: productoExistente[0].stock,
                tiene_descuento: tiene_descuento_producto,
                descuento_porcentaje: porcentaje_descuento_producto ? parseFloat(porcentaje_descuento_producto.toFixed(2)) : null,
                precio_con_descuento_aplicado: tiene_descuento_producto ? parseFloat(precio_esperado_bd_producto.toFixed(2)) : null // El precio final que la DB considera con descuento
            });
        }

        // --- Procesamiento y validación de Calcomanías ---
        const calcomaniasValidadas = [];
        const calcomaniasVistas = new Set();

        for (let i = 0; i < calcomanias.length; i++) {
            const calcomania = calcomanias[i];

            if (!calcomania.id_calcomania || !calcomania.cantidad || !calcomania.tamano || calcomania.precio_usado === undefined || calcomania.precio_usado === null) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    mensaje: `La calcomanía en la posición ${i + 1} debe tener id_calcomania, cantidad, tamaño y precio_usado.`
                });
            }

            const idCalcomaniaLimpia = parseInt(calcomania.id_calcomania);
            const tamanoCalcomania = String(calcomania.tamano).toLowerCase();

            if (!['pequeno', 'mediano', 'grande'].includes(tamanoCalcomania)) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    mensaje: `El tamaño de la calcomanía (pequeno, mediano o grande) en la posición ${i + 1} debe ser válido.`
                });
            }

            const claveUnicaCalcomania = `${idCalcomaniaLimpia}-${tamanoCalcomania}`;
            if (calcomaniasVistas.has(claveUnicaCalcomania)) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    mensaje: `La calcomanía con ID ${idCalcomaniaLimpia} y tamaño ${tamanoCalcomania} está duplicada en la venta.`
                });
            }
            calcomaniasVistas.add(claveUnicaCalcomania);

            if (Number(calcomania.cantidad) <= 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    mensaje: `La cantidad de la calcomanía ${idCalcomaniaLimpia} debe ser mayor a cero.`
                });
            }

            const [calcomaniaExistente] = await connection.execute(
                `SELECT
                   id_calcomania,
                   nombre,
                   precio_unidad,
                   precio_descuento, /* ESTE ES EL PRECIO FINAL CON DESCUENTO APLICADO */
                   stock_pequeno,
                   stock_mediano,
                   stock_grande,
                   estado
                 FROM calcomania
                 WHERE id_calcomania = ?`,
                [idCalcomaniaLimpia]
            );

            if (calcomaniaExistente.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    mensaje: `La calcomanía con ID ${idCalcomaniaLimpia} no existe.`
                });
            }

            if (!calcomaniaExistente[0].estado) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    mensaje: `La calcomanía ${calcomaniaExistente[0].nombre} está inactiva.`
                });
            }

            let stock_disponible_calcomania;
            let precio_base_original_calcomania = parseFloat(calcomaniaExistente[0].precio_unidad); // Precio base de la DB

            // Precio de la calcomanía afectado por el tamaño, ANTES de cualquier descuento
            let precio_por_tamano = precio_base_original_calcomania;

            switch (tamanoCalcomania) {
                case 'pequeno':
                    stock_disponible_calcomania = calcomaniaExistente[0].stock_pequeno;
                    // precio_por_tamano se mantiene igual
                    break;
                case 'mediano':
                    stock_disponible_calcomania = calcomaniaExistente[0].stock_mediano;
                    precio_por_tamano += precio_base_original_calcomania * 1.25;
                    break;
                case 'grande':
                    stock_disponible_calcomania = calcomaniaExistente[0].stock_grande;
                    precio_por_tamano += precio_base_original_calcomania * 3.00;
                    break;
            }

            if (stock_disponible_calcomania < Number(calcomania.cantidad)) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    mensaje: `Stock insuficiente para la calcomanía ${calcomaniaExistente[0].nombre} (tamaño ${tamanoCalcomania}). Stock disponible: ${stock_disponible_calcomania}, solicitado: ${calcomania.cantidad}`
                });
            }

            // **Validar y determinar precios para calcomanías**
            let precio_esperado_bd_calcomania = parseFloat(precio_por_tamano.toFixed(2)); // Por defecto es el precio por tamaño
            let tiene_descuento_calcomania = false;
            let porcentaje_descuento_calcomania = null;

            // Si hay un `precio_descuento` (que es el precio final con descuento) en la DB y es válido
            if (calcomaniaExistente[0].precio_descuento !== null && parseFloat(calcomaniaExistente[0].precio_descuento) > 0 && parseFloat(calcomaniaExistente[0].precio_descuento) < precio_por_tamano) {
                precio_esperado_bd_calcomania = parseFloat(calcomaniaExistente[0].precio_descuento);
                tiene_descuento_calcomania = true;
                // Calcular el porcentaje de descuento, ya que no se guarda en la DB para calcomanías
                porcentaje_descuento_calcomania = ((precio_por_tamano - precio_esperado_bd_calcomania) / precio_por_tamano) * 100;
            }

            // Tolerancia para la validación del precio del frontend
            if (Math.abs(parseFloat(calcomania.precio_usado) - precio_esperado_bd_calcomania) > 0.01) {
                console.warn(`Advertencia: Precio usado para calcomanía ${idCalcomaniaLimpia} (${calcomania.precio_usado}) difiere del esperado en BD (${precio_esperado_bd_calcomania}).`);
                // Considera si quieres forzar el precio de BD aquí:
                // calcomania.precio_usado = precio_esperado_bd_calcomania;
            }

            calcomaniasValidadas.push({
                id_calcomania: idCalcomaniaLimpia,
                nombre: calcomaniaExistente[0].nombre,
                cantidad: Number(calcomania.cantidad),
                tamano: tamanoCalcomania,
                precio_original_por_tamano: parseFloat(precio_por_tamano.toFixed(2)), // Precio antes de descuento, solo afectado por tamaño
                precio_usado: parseFloat(calcomania.precio_usado), // Precio final que se usará para la venta
                stock_disponible_bd: stock_disponible_calcomania,
                tiene_descuento: tiene_descuento_calcomania,
                descuento_porcentaje: porcentaje_descuento_calcomania ? parseFloat(porcentaje_descuento_calcomania.toFixed(2)) : null,
                precio_con_descuento_aplicado: tiene_descuento_calcomania ? parseFloat(precio_esperado_bd_calcomania.toFixed(2)) : null // El precio final que la DB considera con descuento
            });
        }

        // Procesar la fecha de venta
        let fecha_venta_formateada;
        if (fecha_venta) {
            const fechaObj = new Date(fecha_venta);
            if (isNaN(fechaObj.getTime())) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    mensaje: 'La fecha de venta proporcionada no es válida'
                });
            }
            fecha_venta_formateada = fechaObj.toISOString().split('T')[0];
        } else {
            fecha_venta_formateada = new Date().toISOString().split('T')[0];
        }

        // Insertar factura
        await connection.execute(
            `INSERT INTO factura (id_factura, fecha_venta, metodo_pago, valor_total, fk_id_usuario)
             VALUES (?, ?, ?, ?, ?)`,
            [id_factura, fecha_venta_formateada, metodo_pago, Number(valor_total), cliente[0].id_usuario]
        );

        // Insertar detalles de productos y actualizar stock de productos
        for (const producto of productosValidados) {
            await connection.execute(
                `INSERT INTO detalle_factura
                 (FK_id_factura, FK_referencia_producto, cantidad, precio_unidad)
                 VALUES (?, ?, ?, ?)`,
                [id_factura, producto.referencia, producto.cantidad, producto.precio_usado]
            );

            await connection.execute(
                `UPDATE producto
                 SET stock = stock - ?
                 WHERE referencia = ?`,
                [producto.cantidad, producto.referencia]
            );
            console.log(`✅ Producto vendido: ${producto.referencia} - Cantidad: ${producto.cantidad} - Stock actualizado.`);
        }

        // Insertar detalles de calcomanías y actualizar stock de calcomanías
        for (const calcomania of calcomaniasValidadas) {
            await connection.execute(
                `INSERT INTO detalle_factura_calcomania
                 (FK_id_factura, FK_id_calcomania, cantidad, precio_unidad, tamano)
                 VALUES (?, ?, ?, ?, ?)`,
                [id_factura, calcomania.id_calcomania, calcomania.cantidad, calcomania.precio_usado, calcomania.tamano]
            );

            // Actualizar stock de calcomanía según el tamaño
            let updateQuery;
            switch (calcomania.tamano) {
                case 'pequeno':
                    updateQuery = `UPDATE calcomania SET stock_pequeno = stock_pequeno - ? WHERE id_calcomania = ?`;
                    break;
                case 'mediano':
                    updateQuery = `UPDATE calcomania SET stock_mediano = stock_mediano - ? WHERE id_calcomania = ?`;
                    break;
                case 'grande':
                    updateQuery = `UPDATE calcomania SET stock_grande = stock_grande - ? WHERE id_calcomania = ?`;
                    break;
            }
            await connection.execute(updateQuery, [calcomania.cantidad, calcomania.id_calcomania]);
            console.log(`✅ Calcomanía vendida: ${calcomania.nombre} (ID: ${calcomania.id_calcomania}, Tamaño: ${calcomania.tamano}) - Cantidad: ${calcomania.cantidad} - Stock actualizado.`);
        }

        await connection.commit();

        // Preparar datos de la factura para respuesta y email
        const facturaData = {
            id_factura,
            fecha_venta: new Date(fecha_venta_formateada).toLocaleDateString('es-CO'),
            metodo_pago,
            valor_total_numerico: Number(valor_total),
            cliente: {
                cedula: cliente[0].cedula,
                nombre: cliente[0].nombre,
                correo: cliente[0].correo,
                telefono: cliente[0].telefono
            },
            // Formatear productos para el email/respuesta
            productos: productosValidados.map(p => ({
                referencia: p.referencia,
                nombre: p.nombre,
                cantidad: p.cantidad,
                // precio_unitario es el precio FINAL usado en la venta (con descuento si aplicó)
                precio_unitario: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(p.precio_usado),
                // subtotal_item: Subtotal calculado del item
                subtotal_item: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(p.precio_usado * p.cantidad),
                tiene_descuento: p.tiene_descuento,
                // Si tiene descuento, mostramos el precio original y el porcentaje.
                // Si no, estos serán null.
                precio_original_sin_descuento: p.tiene_descuento ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(p.precio_unidad_base_original) : null,
                porcentaje_descuento: p.tiene_descuento ? `${p.descuento_porcentaje}%` : null
            })),
            // Formatear calcomanías para el email/respuesta
            calcomanias: calcomaniasValidadas.map(c => ({
                id: c.id_calcomania,
                nombre: c.nombre,
                cantidad: c.cantidad,
                tamano: c.tamano,
                // precio_unitario: Es el precio FINAL usado en la venta (con descuento si aplicó)
                precio_unitario: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(c.precio_usado),
                // subtotal_item: Subtotal del item ya calculado
                subtotal_item: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(c.precio_usado * c.cantidad),
                tiene_descuento: c.tiene_descuento,
                // Si tiene descuento, mostramos el precio original (por tamaño) y el porcentaje calculado.
                // Si no, estos serán null.
                precio_original_sin_descuento: c.tiene_descuento ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(c.precio_original_por_tamano) : null,
                porcentaje_descuento: c.tiene_descuento ? `${c.descuento_porcentaje}%` : null
            })),
            valor_total: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(valor_total)),
            total_items: productosValidados.length + calcomaniasValidadas.length
        };

        // Enviar correo con PDF si se solicita
        if (enviar_correo && cliente[0].correo) {
            try {
                await emailService.enviarFacturaPorCorreo(cliente[0].correo, facturaData);
                console.log(`📧 Correo con factura enviado a: ${cliente[0].correo}`);
            } catch (emailError) {
                console.error('❌ Error al enviar correo:', emailError);
                // No revertir la transacción por un error de envío de correo, solo registrar el error
            }
        }

        return res.status(201).json({
            success: true,
            mensaje: 'Venta registrada exitosamente' + (enviar_correo ? ' y correo enviado.' : '.'),
            factura: facturaData
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error al registrar venta:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error interno al registrar la venta.'
        });
    } finally {
        connection.release();
    }
}

// Exportamos los métodos
module.exports = {
    ValidarClientePorCedula,
    BuscarProductoVentaPorReferencia,
    BuscarCalcomaniaVentaPorId,
    RegistrarVenta
};