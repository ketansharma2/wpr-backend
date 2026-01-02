const supabase = require("../../config/supabase");

module.exports = async function (req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
        return res.status(401).json({ message: "Invalid token" });
    }

    // Fetch user details including user_type
    const { data: userData, error: userError } = await supabase
        .from("users")
        .select("user_id, name, email, dept, role, user_type")
        .eq("user_id", data.user.id)
        .single();

    if (userError) {
        return res.status(500).json({ message: "Error fetching user details" });
    }

    req.user = {
        ...data.user,
        user_type: userData.user_type,
        dept: userData.dept
    };
    next();
};
