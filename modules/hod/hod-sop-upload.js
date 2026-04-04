const express = require("express");
const multer = require("multer");
const supabase = require("../../config/supabase");
const auth = require("../auth/authMiddleware");

const router = express.Router();
router.use(auth);

const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { user_id, pdf_name } = req.body;
    const file = req.file;

    if (!user_id || !pdf_name || !file) {
      return res.status(400).json({ error: "All fields required" });
    }

    // unique filename
    const fileName = `${Date.now()}_${file.originalname}`;

    // upload to supabase storage
    const { error: uploadError } = await supabase.storage
      .from("sop_docs")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype
      });

    if (uploadError) {
      console.log(uploadError);
      return res.status(500).json({ error: "File upload failed" });
    }

    // public url
    const { data: publicUrlData } = supabase.storage
      .from("sop_docs")
      .getPublicUrl(fileName);

    const newLink = {
      url: publicUrlData.publicUrl,
      name: pdf_name
    };

    const { data: existingSop, error: fetchError } = await supabase
  .from("sop")
  .select("*")
  .eq("user_id", user_id)
  .maybeSingle();

    if (existingSop) {
      // append existing links
      const updatedLinks = [...(existingSop.links || []), newLink];

      const { error: updateError } = await supabase
        .from("sop")
        .update({ links: updatedLinks })
        .eq("user_id", user_id);

      if (updateError) {
        console.log(updateError);
        return res.status(500).json({ error: "Update failed" });
      }

    } else {
      // insert new row
      const { error: insertError } = await supabase
        .from("sop")
        .insert([
          {
            user_id,
            links: [newLink]
          }
        ]);

      if (insertError) {
        console.log(insertError);
        return res.status(500).json({ error: "Insert failed" });
      }
    }

    res.status(200).json({
      success: true,
      message: "SOP uploaded successfully"
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;