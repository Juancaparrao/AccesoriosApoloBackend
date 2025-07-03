require("dotenv").config();
const fetch = require('node-fetch');

const db = require("../db");

async function obtenerProductos() {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.referencia,
                p.nombre,
                p.precio_unidad,
                p.stock,
                p.marca,
                c.nombre_categoria,
                s.nombre_subcategoria
            FROM producto p
            INNER JOIN categoria c ON p.FK_id_categoria = c.id_categoria
            INNER JOIN subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
            WHERE p.stock > 0
        `);
        return rows;
    } catch (error) {
        console.error("Error al obtener productos:", error);
        throw error;
    }
}

async function infoChat(req, res) {
    const { message } = req.body;

    try {
        const inventario = await obtenerProductos();
        const respuesta = await getChatResponse(message, inventario);
        res.json({ respuesta });
    } catch (err) {
        console.error("Error general:", err);
        res.status(500).json({ error: "Error al procesar la solicitud" });
    }
}

// Función para obtener modelos disponibles
async function obtenerModelosDisponibles() {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            console.error("❌ Error al obtener modelos:", response.status);
            return null;
        }

        const data = await response.json();
        const modelos = data.data.map(model => model.id);
        console.log("✅ Modelos disponibles encontrados:", modelos.slice(0, 10)); // Mostrar solo los primeros 10
        return modelos;
    } catch (error) {
        console.error("❌ Error al consultar modelos:", error);
        return null;
    }
}

// Función para seleccionar el mejor modelo disponible
async function seleccionarModelo() {
    const modelos = await obtenerModelosDisponibles();
    
    if (!modelos) {
        console.log("⚠️ No se pudieron obtener modelos, usando modelo por defecto");
        return "gpt-3.5-turbo"; // Fallback básico
    }

    // Lista de modelos preferidos en orden de preferencia
    const modelosPreferidos = [
        "openai/gpt-4o-mini",
        "openai/gpt-4o",
        "openai/gpt-3.5-turbo",
        "anthropic/claude-3-haiku",
        "google/gemini-pro",
        "meta-llama/llama-3.1-8b-instruct:free",
        "microsoft/wizardlm-2-8x22b:free",
        "google/gemma-2-9b-it:free",
        "nousresearch/hermes-3-llama-3.1-405b:free",
        "qwen/qwen-2-7b-instruct:free"
    ];

    // Buscar el primer modelo disponible
    for (const modelo of modelosPreferidos) {
        if (modelos.includes(modelo)) {
            console.log(`✅ Usando modelo: ${modelo}`);
            return modelo;
        }
    }

    // Si no encuentra ninguno preferido, usar el primer modelo disponible
    const primerModelo = modelos[0];
    console.log(`⚠️ Usando primer modelo disponible: ${primerModelo}`);
    return primerModelo;
}

async function getChatResponse(message, inventario) {
    const infoEmpresa = `El aplicativo de Accesorios Apolo será una herramienta integral pensada para modernizar y agilizar 
la gestión del negocio. Permitirá organizar y controlar de forma eficiente el inventario, registrar 
las ventas de manera detallada, administrar la base de datos de clientes y mostrar un catálogo 
digital atractivo. Todo esto estará centralizado en un panel administrativo intuitivo que facilitará 
el análisis de datos y la toma de decisiones. Con este aplicativo, Accesorios Apolo podrá optimizar 
sus procesos, ofrecer una mejor experiencia a sus clientes y fortalecer su presencia en el entorno digital.

Ubicación: Accesorios Apolo está ubicado en Montenegro, Quindío. Dirección: Cra. 6 #21-28.

Horarios de atención:
Lunes a sabado: 9:00 AM - 07:00 PM. 
Domingos y festivos: No hay atención.

Información de contacto:
Teléfono: 323 326 4572.
Correo electrónico: accesoriosapolom@gmail.com
Instagram: @accesoriosapolom
Facebook: Accesories Apolo  

Administrador y dueño actual: Herney Restrepo Ortiz.

Misión:
En nuestra empresa de accesorios para motos, nos comprometemos a proporcionar productos de alta calidad 
que potencien la experiencia de los motociclistas, garantizando seguridad, comodidad y estilo. Nos esforzamos 
por ofrecer una amplia gama de accesorios innovadores y funcionales, respaldados por un compromiso inquebrantable 
con la excelencia en el diseño, la fabricación y la satisfacción del cliente.  
Nuestro propósito es no solo equipar a los motociclistas con accesorios superiores, sino también promover una 
cultura de seguridad en la conducción, creando así una comunidad comprometida con la pasión por las motos y el 
respeto por la carretera.

Visión:
Nos visualizamos como líderes en la industria de accesorios para motos, siendo reconocidos a nivel nacional 
e internacional por nuestra innovación, calidad y compromiso con la seguridad. Buscamos expandir continuamente 
nuestra gama de productos, utilizando tecnologías avanzadas y materiales de vanguardia para brindar soluciones 
que excedan las expectativas de nuestros clientes.

Aspiramos a ser un referente en la comunidad motociclista, no solo por nuestros productos, sino también por nuestro 
compromiso con la educación vial y la promoción de la seguridad en la conducción. Queremos ser la opción preferida 
de los motociclistas, siendo su compañero de confianza en cada viaje, impulsando su pasión y protegiendo su bienestar 
en la carretera.

Para registrarte en el aplicativo de Accesorios Apolo, sigue estos pasos:
1. Encontramos en la página de inicio del aplicativo la barra de navegación superior, donde se encuentra la opcion de "Registrarse".
2. Haz clic en "Registrarse" y completa el formulario con tus datos personales: nombre, telefono, correo electrónico y contraseña.
3. Al terminar de completar el formulario correctamente, haz clic en "Registrarse" para crear tu cuenta.
4. Recibirás un correo electrónico con un codigo OTP de confirmación.
5. Ingresa el código OTP en el aplicativo para verificar tu cuenta.
6. Una vez verificado, te aparecerá un mensaje de bienvenida y podrás acceder al aplicativo.

Para iniciar sesión en el aplicativo de Accesorios Apolo, sigue estos pasos:
1. En la página de inicio del aplicativo, dirígete a la barra de navegación superior
donde encontrarás la opción "Iniciar Sesión".
2. Haz clic en "Iniciar Sesión" y completa el formulario con tu correo electrónico y contraseña.
3. Asegúrate de que los datos sean correctos y haz clic en "Iniciar Sesión".
4. Si los datos son válidos, serás redirigido al panel de control del aplicativo, donde podrás acceder a todas las funcionalidades disponibles.

Si olvidaste tu contraseña, puedes restablecerla siguiendo estos pasos: 
1. En la página de inicio del aplicativo, dirígete a la barra de navegación superior y haz clic en "Iniciar Sesión".
2. En la página de inicio de sesión, encontrarás un enlace que dice "¿Olvidaste tu contraseña?".
3. Haz clic en ese enlace y se te pedirá que ingreses tu correo electrónico asociado a tu cuenta.
4. Después de ingresar tu correo, recibirás un correo electrónico con un enlace para restableecer tu contraseña.
5. Haz clic en el enlace del correo y serás redirigido a una página donde podrás ingresar una nueva contraseña.
6. Ingresa tu nueva contraseña y confírmala.
`;

    // Verificar que la API key existe
    if (!process.env.OPENROUTER_API_KEY) {
        console.error("❌ OPENROUTER_API_KEY no está configurada en las variables de entorno");
        return "Error de configuración del servicio de IA.";
    }

    // Log para debug (solo mostrar los primeros caracteres por seguridad)
    console.log("🔑 API Key encontrada:", process.env.OPENROUTER_API_KEY.substring(0, 10) + "...");

    // Seleccionar modelo disponible
    const modeloSeleccionado = await seleccionarModelo();

    const messages = [
        {
            role: "system",
            content: `Eres un asistente virtual de Accesorios Apolo. Solo debes responder preguntas relacionadas con la empresa Accesorios Apolo, su inventario, ubicación, misión, visión, contacto, horario o administrador.

Si te hacen una pregunta que no esté relacionada con la empresa o su inventario, responde con:
"Lo siento, solo puedo responder preguntas relacionadas con Accesorios Apolo y su aplicativo.".

Aquí tienes información de referencia sobre la empresa e inventario:

${infoEmpresa}

Inventario actual:
${JSON.stringify(inventario)}`
        },
        {
            role: "user",
            content: message
        }
    ];

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://accesorios-apolo-frontend.vercel.app", // Opcional: tu dominio
                "X-Title": "AccesoriosApolo" // Opcional: nombre de tu app
            },
            body: JSON.stringify({
                model: modeloSeleccionado, // ✅ Modelo seleccionado dinámicamente
                messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        // Verificar el status de la respuesta
        if (!response.ok) {
            console.error("❌ Error HTTP:", response.status, response.statusText);
            const errorText = await response.text();
            console.error("❌ Error body:", errorText);
            return "Error al conectar con el servicio de IA.";
        }

        const data = await response.json();
        console.log("✅ Respuesta recibida:", data);

        if (data?.error) {
            console.error("❌ Error en respuesta IA:", data.error);
            return "Ocurrió un error con el servicio de IA.";
        }

        const respuestaIA = data.choices?.[0]?.message?.content?.trim();
        return respuestaIA?.length >= 5 ? respuestaIA : "No entendí tu pregunta. ¿Podrías reformularla?";
    } catch (err) {
        console.error("❌ Error general en getChatResponse:", err.message || err);
        return "Error al procesar la respuesta con IA.";
    }
}

module.exports = {
    infoChat
};