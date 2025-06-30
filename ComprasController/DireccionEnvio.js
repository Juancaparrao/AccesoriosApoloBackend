const pool = require('../db');
// const bcrypt = require('bcrypt'); // Ya no es necesario aquí si no manejamos contraseñas

async function DireccionEnvio(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Función DireccionEnvio (Actualizada y Corregida) ===");
        console.log("req.user (desde token):", req.user); // Información si el usuario está autenticado

        const {
            nombre,
            cedula,
            telefono,
            correo,
            direccion,
            informacion_adicional // Sigue siendo opcional según tu esquema DB
        } = req.body;

        // 1. Validación de campos obligatorios
        if (!nombre || !cedula || !telefono || !correo || !direccion) {
            return res.status(400).json({
                success: false,
                mensaje: 'Los campos nombre, cédula, teléfono, correo y dirección son obligatorios.'
            });
        }

        let fk_id_usuario = null;
        let userDataToReturn = {};
        let userWasRegisteredInDB = false; // Indica si el usuario ya existe en la tabla USUARIO

        // Inicializar req.session.checkout si no existe
        req.session.checkout = req.session.checkout || {};

        // Verificar si el usuario está autenticado a través del token
        if (req.user && req.user.id_usuario) {
            // --- Usuario AUTENTICADO ---
            console.log("Usuario AUTENTICADO. ID:", req.user.id_usuario);
            fk_id_usuario = req.user.id_usuario;
            userWasRegisteredInDB = true;

            // Obtener los datos actuales del usuario desde la DB
            const [userCheck] = await pool.execute(
                `SELECT nombre, cedula, telefono, correo FROM usuario WHERE id_usuario = ?`,
                [fk_id_usuario]
            );

            if (userCheck.length === 0) {
                // Esto no debería ocurrir si el token es válido
                return res.status(401).json({
                    success: false,
                    mensaje: 'Usuario autenticado no encontrado en la base de datos.'
                });
            }

            const currentUser = userCheck[0];
            let updateFields = [];
            let updateValues = [];

            // Actualizar datos del usuario si son diferentes de los proporcionados
            if (nombre !== currentUser.nombre) {
                updateFields.push('nombre = ?');
                updateValues.push(nombre);
            }
            if (parseInt(cedula, 10) !== currentUser.cedula) {
                updateFields.push('cedula = ?');
                updateValues.push(cedula);
            }
            if (telefono !== currentUser.telefono) {
                updateFields.push('telefono = ?');
                updateValues.push(telefono);
            }
            // El correo no se actualiza aquí, solo se valida que el proporcionado sea el del token.
            if (correo !== currentUser.correo) {
                console.warn(`[Seguridad] Correo proporcionado (${correo}) no coincide con el del token (${currentUser.correo}).`);
                return res.status(403).json({
                    success: false,
                    mensaje: 'El correo proporcionado no coincide con el de su cuenta autenticada. Por favor, inicie sesión con el correo correcto o cierre sesión para realizar una compra como invitado.'
                });
            }


            if (updateFields.length > 0) {
                const updateQuery = `UPDATE usuario SET ${updateFields.join(', ')} WHERE id_usuario = ?`;
                updateValues.push(fk_id_usuario);
                await pool.execute(updateQuery, updateValues);
                console.log(`Usuario ID ${fk_id_usuario} actualizado con nuevos datos.`);
            }

            // Obtener la dirección de la última compra si existe para el usuario autenticado
            const [lastPurchase] = await pool.execute(
                `SELECT direccion, informacion_adicional FROM factura WHERE fk_id_usuario = ? ORDER BY fecha_venta DESC LIMIT 1`,
                [fk_id_usuario]
            );

            userDataToReturn = {
                nombre: nombre,
                cedula: cedula,
                telefono: telefono,
                correo: correo,
                direccion_anterior: lastPurchase.length > 0 ? lastPurchase[0].direccion : null,
                informacion_adicional_anterior: lastPurchase.length > 0 ? lastPurchase[0].informacion_adicional : null
            };

            // Almacenar la información de envío actual temporalmente en la sesión asociada al ID de usuario
            req.session.checkout.direccion_envio = { // Usamos una clave más genérica `direccion_envio`
                id_usuario: fk_id_usuario, // Guardamos el ID de usuario si está autenticado
                nombre: nombre,
                cedula: cedula,
                telefono: telefono,
                correo: correo,
                direccion: direccion,
                informacion_adicional: informacion_adicional || null
            };
            console.log("Dirección de envío temporalmente guardada en sesión para usuario autenticado.");

        } else {
            // --- Usuario NO AUTENTICADO ---
            console.log("Usuario NO AUTENTICADO.");

            // Buscar si el correo electrónico ya existe en la tabla USUARIO
            const [existingUserByEmail] = await pool.execute(
                `SELECT id_usuario, nombre, cedula, telefono, correo FROM usuario WHERE correo = ?`,
                [correo]
            );

            if (existingUserByEmail.length > 0) {
                // Scenario 2: El correo electrónico existe en la DB, pero el usuario no está autenticado.
                // Usamos su ID existente y actualizamos sus datos de contacto en la DB.
                fk_id_usuario = existingUserByEmail[0].id_usuario;
                userWasRegisteredInDB = true;

                console.log("Correo ya registrado, usuario no autenticado. ID:", fk_id_usuario);

                const existingUser = existingUserByEmail[0];
                let updateFields = [];
                let updateValues = [];

                if (nombre !== existingUser.nombre) {
                    updateFields.push('nombre = ?');
                    updateValues.push(nombre);
                }
                if (parseInt(cedula, 10) !== existingUser.cedula) {
                    updateFields.push('cedula = ?');
                    updateValues.push(cedula);
                }
                if (telefono !== existingUser.telefono) {
                    updateFields.push('telefono = ?');
                    updateValues.push(telefono);
                }

                if (updateFields.length > 0) {
                    const updateQuery = `UPDATE usuario SET ${updateFields.join(', ')} WHERE id_usuario = ?`;
                    updateValues.push(fk_id_usuario);
                    await pool.execute(updateQuery, updateValues);
                    console.log(`Datos de usuario existente (ID: ${fk_id_usuario}, no autenticado) actualizados en DB.`);
                }

                // Obtener la dirección de la última compra para este usuario existente
                const [lastPurchase] = await pool.execute(
                    `SELECT direccion, informacion_adicional FROM factura WHERE fk_id_usuario = ? ORDER BY fecha_venta DESC LIMIT 1`,
                    [fk_id_usuario]
                );

                userDataToReturn = {
                    nombre: nombre,
                    cedula: cedula,
                    telefono: telefono,
                    correo: correo,
                    direccion_anterior: lastPurchase.length > 0 ? lastPurchase[0].direccion : null,
                    informacion_adicional_anterior: lastPurchase.length > 0 ? lastPurchase[0].informacion_adicional : null
                };

                // Almacenar la información de envío actual temporalmente en la sesión, asociada al ID de usuario encontrado
                req.session.checkout.direccion_envio = {
                    id_usuario: fk_id_usuario, // Guardamos el ID de usuario encontrado
                    nombre: nombre,
                    cedula: cedula,
                    telefono: telefono,
                    correo: correo,
                    direccion: direccion,
                    informacion_adicional: informacion_adicional || null
                };
                console.log("Dirección de envío temporalmente guardada en sesión para usuario existente no autenticado.");

            } else {
                // Scenario 3: El correo NO existe en la DB y el usuario NO está autenticado.
                // ¡Aquí es donde lo guardamos TEMPORALMENTE en la sesión SIN registrarlo en la DB aún!
                console.log("Correo NO registrado en DB. Guardando datos temporalmente en sesión para nuevo usuario.");

                // No hay fk_id_usuario aún, ya que no se ha registrado en la DB.
                // Asociaremos estos datos a la sesión actual (req.sessionID)
                fk_id_usuario = null; // Confirmamos que no hay un ID de DB asignado aún
                userWasRegisteredInDB = false; // Confirmamos que NO está en la DB

                userDataToReturn = {
                    nombre: nombre,
                    cedula: cedula,
                    telefono: telefono,
                    correo: correo,
                    direccion_anterior: null, // No hay historial para un usuario no registrado
                    informacion_adicional_anterior: null
                };

                // Almacenar la información de envío actual temporalmente en la sesión.
                // Usamos `id_usuario: null` para indicar que aún no hay un registro persistente.
                req.session.checkout.direccion_envio = {
                    id_usuario: null, // Indica que este es un usuario "invitado" sin ID de DB aún
                    nombre: nombre,
                    cedula: cedula,
                    telefono: telefono,
                    correo: correo,
                    direccion: direccion,
                    informacion_adicional: informacion_adicional || null
                };
                console.log("Datos de usuario 'invitado' y dirección de envío guardados temporalmente en sesión.");
            }
        }

        // Respuesta final
        res.status(200).json({
            success: true,
            mensaje: 'Información de envío procesada y guardada temporalmente. Puedes continuar con la compra.',
            usuario_existente_en_db: userWasRegisteredInDB,
            datos_usuario: userDataToReturn,
            direccion_temporal_guardada: {
                direccion: direccion,
                informacion_adicional: informacion_adicional || null
            }
        });

    } catch (error) {
        console.error('Error en la función DireccionEnvio:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al procesar la dirección de envío.'
        });
    }
}

module.exports = {
    DireccionEnvio
};