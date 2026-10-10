import jwt from "jsonwebtoken";

class Jwt {

    generateToken(user) {

        return jwt.sign(
            {
                id: user.id,
                email: user.email,
                rol: user.rol,
                sessionVersion: user.sessionVersion
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h"
            }
        );

    }

    verifyToken(token) {

        return jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );

    }

}

export default new Jwt();
