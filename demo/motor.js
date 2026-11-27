// GENERADO por tools/sincronizar_motor.py a partir de bot/responder.js.
// No editar a mano: cambia el motor real y vuelve a sincronizar.
//
// responder(texto, datos, estado) -> { respuestas: string[], estado, avisarDueno, motivo }

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

function extraerDia(t) {
  const dia = DIAS.find((d) => t.includes(d));
  if (dia) return dia;
  return t.includes("manana") ? "mañana" : null;
}

function extraerHora(texto) {
  const m = texto.match(/(?:a las|alas|para las|tipo)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?)?/i);
  if (!m) return "";
  const hora = String(parseInt(m[1], 10)).padStart(2, "0");
  const min = m[2] || "00";
  let sufijo = (m[3] || "").toLowerCase().replace(/\./g, "");
  if (sufijo) sufijo = " " + sufijo;
  return `${hora}:${min}${sufijo}`;
}

function soloDigitos(texto) {
  return String(texto || "").replace(/\D/g, "");
}

function coincide(texto, palabras) {
  return palabras.some((p) => texto.includes(normalizar(p)));
}

function precios(datos) {
  const servicios = (datos.servicios || []).map(
    (s) => `• ${s.nombre}: ${s.precio}${s.nota ? " (" + s.nota + ")" : ""}`,
  );
  return servicios.length ? servicios.join("\n") : "";
}

function responder(texto, datos, estado = {}) {
  const t = normalizar(texto);
  const e = { ...estado };
  const negocio = datos.negocio || "el negocio";
  const out = { respuestas: [], estado: e, avisarDueno: false, motivo: "" };

  if (!t) {
    out.respuestas.push("No te escuché bien. ¿Me escribes de nuevo, por favor?");
    return out;
  }

  // --- Flujo de cita en curso (tiene prioridad sobre todo lo demás) ---
  const enFlujo = e.fase && e.fase !== "cerrada";

  if (enFlujo && coincide(t, ["cancelar", "anular", "cancelalo", "cancelala"])) {
    e.fase = null;
    e.cita = null;
    out.respuestas.push("Listo, no agendo nada. Si quieres, empezamos de nuevo cuando te convenga.");
    return out;
  }

  if (e.fase === "pidiendo_dia") {
    const dia = extraerDia(t);
    if (!dia) {
      out.respuestas.push("¿Qué día te queda mejor? Puede ser un día de la semana" +
        (datos.horario ? " (horario: " + datos.horario + ")." : "."));
      return out;
    }
    e.cita = { dia, hora: extraerHora(texto) };
    e.fase = "confirmando";
    out.respuestas.push(`Perfecto, ${dia}${e.cita.hora ? " a las " + e.cita.hora : ""}. ¿Te confirmo la cita? Responde "sí" o "no".`);
    return out;
  }

  if (e.fase === "confirmando") {
    if (coincide(t, ["si", "dale", "ok", "confirmo", "correcto", "bueno", "claro"])) {
      e.fase = "pidiendo_nombre";
      out.respuestas.push("Listo. ¿Me dices tu nombre para apartarla?");
      return out;
    }
    if (coincide(t, ["no", "mejor no", "cambiar", "otro dia"])) {
      e.fase = "pidiendo_dia";
      e.cita = null;
      out.respuestas.push("Sin problema. ¿Qué otro día te queda mejor?");
      return out;
    }
    out.respuestas.push('Responde "sí" para confirmar o "no" para cambiar el día.');
    return out;
  }

  if (e.fase === "pidiendo_nombre") {
    const digitos = soloDigitos(texto);
    if (digitos.length >= 7) { // mandó el teléfono antes que el nombre
      e.cita = { ...(e.cita || {}), telefono: digitos };
      out.respuestas.push("Gracias, ya tengo tu teléfono. ¿Y tu nombre?");
      return out;
    }
    const nombre = String(texto).trim().replace(/[^\p{L}\s.'-]/gu, "").slice(0, 40).trim();
    if (!nombre) {
      out.respuestas.push("¿Me repites tu nombre, por favor?");
      return out;
    }
    e.cita = { ...(e.cita || {}), nombre };
    e.fase = "pidiendo_telefono";
    out.respuestas.push(`Gracias, ${nombre}. ¿Me dejas un teléfono de contacto por si hay que avisarte?`);
    return out;
  }

  if (e.fase === "pidiendo_telefono") {
    const digitos = soloDigitos(texto);
    if (digitos.length < 7) {
      out.respuestas.push("Ese número no me quedó completo. ¿Me lo escribes con el área? (ej. 809-555-1234)");
      return out;
    }
    e.cita = { ...(e.cita || {}), telefono: digitos };
    e.fase = "cerrada";
    const h = e.cita.hora ? " a las " + e.cita.hora : "";
    out.respuestas.push(
      `Listo, ${e.cita.nombre}. Te aparté la cita del ${e.cita.dia}${h} y una persona del equipo te confirma por aquí. ¡Gracias!`,
    );
    out.avisarDueno = true;
    out.motivo = `Nueva cita pedida: ${e.cita.nombre} — ${e.cita.telefono} — ${e.cita.dia}${h}`;
    return out;
  }

  // --- Intenciones normales ---
  if (coincide(t, ["hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "que tal"])) {
    out.respuestas.push(`¡Hola! Soy el asistente de ${negocio}. ¿En qué te ayudo?`);
    return out;
  }

  if (coincide(t, ["precio", "cuanto", "cuesta", "costo", "tarifa", "vale"])) {
    const lista = precios(datos);
    if (lista) {
      out.respuestas.push(`Estos son nuestros precios:\n${lista}\n\n¿Te agendo una cita?`);
    } else {
      out.respuestas.push("Los precios te los confirma una persona del equipo, ya le avisé.");
      out.avisarDueno = true;
      out.motivo = "Preguntó precios y el negocio no tiene lista cargada";
    }
    return out;
  }

  if (coincide(t, ["horario", "abren", "cierran", "hora", "abierto", "domingo"])) {
    out.respuestas.push(
      datos.horario ? `Nuestro horario: ${datos.horario}.` : "El horario te lo confirma el equipo, ya le avisé.",
    );
    if (!datos.horario) { out.avisarDueno = true; out.motivo = "Preguntó horario no cargado"; }
    return out;
  }

  if (coincide(t, ["donde", "ubicacion", "direccion", "llegar", "mapa"])) {
    const partes = [datos.direccion, datos.mapa].filter(Boolean);
    out.respuestas.push(partes.length ? `Estamos en: ${partes.join(" · ")}` : "La dirección te la da el equipo, ya le avisé.");
    if (!partes.length) { out.avisarDueno = true; out.motivo = "Preguntó ubicación no cargada"; }
    return out;
  }

  if (coincide(t, ["pago", "tarjeta", "efectivo", "transferencia", "formas de pago"])) {
    out.respuestas.push(datos.pagos ? `Formas de pago: ${datos.pagos}.` : "Formas de pago: te confirma el equipo.");
    return out;
  }

  if (coincide(t, ["persona", "humano", "agente", "alguien", "hablar con alguien", "atencion al cliente"])) {
    out.respuestas.push("Ya avisé a una persona del equipo para que te escriba. ¿Quieres que mientras tanto te agende una cita?");
    out.avisarDueno = true;
    out.motivo = "El cliente pidió hablar con una persona";
    return out;
  }

  if (coincide(t, ["cita", "agendar", "agenda", "turno", "reservar", "disponible", "disponibilidad"])) {
    const dia = extraerDia(t);
    const hora = extraerHora(texto);
    if (dia) { // ya dijo el día en el mismo mensaje ("quiero cita el viernes a las 3")
      e.cita = { dia, hora };
      e.fase = "confirmando";
      out.respuestas.push(`Tengo ${dia}${hora ? " a las " + hora : ""}. ¿Te confirmo la cita? Responde "sí" o "no".`);
      return out;
    }
    e.fase = "pidiendo_dia";
    e.cita = null;
    out.respuestas.push("Con gusto. ¿Qué día te queda mejor?");
    return out;
  }

  // --- Preguntas frecuentes cargadas por el negocio ---
  for (const faq of datos.faqs || []) {
    if (coincide(t, faq.preguntas || [])) {
      out.respuestas.push(faq.respuesta);
      return out;
    }
  }

  if (coincide(t, ["gracias", "ok", "perfecto", "dale", "excelente"])) {
    out.respuestas.push("¡A la orden! Cualquier cosa me escribes por aquí.");
    return out;
  }

  // --- No sabe: no inventa, deriva a humano ---
  out.respuestas.push(
    "Esa no la tengo con seguridad. Ya le avisé a una persona del equipo para que te responda. " +
    "¿Quieres que mientras tanto te agende una cita?",
  );
  out.avisarDueno = true;
  out.motivo = `Pregunta sin respuesta: "${String(texto).slice(0, 160)}"`;
  return out;
}

function avisoDueno(motivo, datos) {
  return `🔔 ${datos.negocio || "Negocio"}\n${motivo}`;
}

const DIAS_SEMANA = DIAS;
// Exposición para el demo (navegador) y para pruebas (Node).
(function () {
  var api = { responder: responder, avisoDueno: avisoDueno, normalizar: normalizar, DIAS_SEMANA: DIAS_SEMANA };
  if (typeof window !== "undefined") { window.Recepcionista = api; }
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
})();
