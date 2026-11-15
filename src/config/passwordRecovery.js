export function trustedResetUrl(value, env = process.env) {
    if (!value) return null;
    let url;
    try { url = new URL(value); } catch { throw new Error("PASSWORD_RESET_URL debe ser una URL confiable HTTP(S)."); }
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const localEnvironment = [undefined, "development", "test"].includes(env.NODE_ENV);
    if (url.username || url.password || !url.hostname ||
        !(url.protocol === "https:" || (url.protocol === "http:" && local && localEnvironment))) {
        throw new Error("PASSWORD_RESET_URL requiere HTTPS; HTTP solo se admite en loopback para desarrollo/pruebas locales, sin credenciales.");
    }
    // Una ruta hash de GoRouter lleva su propia query; nunca anteponer el token al #.
    if (url.search || (url.hash ? url.hash !== "#/reset-password" : url.pathname !== "/reset-password")) {
        throw new Error("PASSWORD_RESET_URL requiere la ruta /reset-password (o #/reset-password), sin query ni token.");
    }
    return url.toString();
}

export function resetLink(baseUrl, token) {
    const url = new URL(baseUrl);
    if (url.hash) {
        const [route, query = ""] = url.hash.slice(1).split("?");
        const parameters = new URLSearchParams(query);
        parameters.set("token", token);
        url.hash = `${route}?${parameters}`;
    } else {
        url.searchParams.set("token", token);
    }
    return url.toString();
}
