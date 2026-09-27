---
name: illustrator
description: "Illustrator tool map — read, documents, draw, edit, place, styles"
metadata:
  label: Illustrator
---

# Illustrator

Call `illustrator_<name>`. A window titled `Something.ai` means the file is open —
start with `illustrator_get_document_info`. Work stays in Illustrator; do not
open Photoshop for an `.ai`.

Coordinates: CMYK/print uses the document origin; RGB/web uses artboard-web.
`illustrator_set_workflow` overrides that.

Exports land in `%LOCALAPPDATA%/UEFN-Ducky/tool_captures/`. Single PNG/JPG
exports return image bytes; `target: "artboard:all"` returns file paths.

## Read

`get_document_info`, `get_document_structure`, `get_artboards`, `get_selection`,
`get_layers`, `get_groups`, `get_path_items`, `get_images`, `get_colors`,
`get_symbols`, `get_effects`, `get_guidelines`, `get_text_frame_detail`,
`list_text_frames`, `list_fonts`, `list_graphic_styles`, `list_text_styles`,
`find_objects`, `extract_design_tokens`, `check_contrast`,
`check_text_consistency`, `preflight_check`, `get_overprint_info`,
`get_separation_info`.

## Documents

`create_document`, `open_document`, `save_document`, `close_document`,
`export`, `export_pdf`, `manage_artboards`, `set_workflow`, `undo`.

`export` target is `artboard:all` or `artboard:0`. PDF export needs a human
check before it is treated as final.

## Draw

`create_rectangle`, `create_ellipse`, `create_line`, `create_path`,
`create_text_frame`, `create_path_text`, `create_gradient`, `create_crop_marks`.

## Edit

`modify_object`, `align_objects`, `select_objects`, `delete_objects`,
`duplicate_objects`, `group_objects`, `ungroup_objects`, `set_z_order`,
`move_to_layer`, `convert_to_outlines`, `replace_color`, `resize_for_variation`.

## Place and manage

`place_image`, `place_symbol`, `place_color_chips`, `place_style_guide`,
`import_svg_as_editable`, `manage_layers`, `manage_swatches`,
`manage_linked_images`, `manage_datasets`, `assign_color_profile`,
`apply_graphic_style`, `apply_text_style`, `convert_coordinate`.

`assign_color_profile` only retags the profile. It does not convert color values.

`adobe_list_tools` is the live census if a name above is missing.
