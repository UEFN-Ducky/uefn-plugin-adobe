---
name: photoshop
description: "Photoshop tool map — documents, layers, pixels, type, masks, recipes"
metadata:
  label: Photoshop
---

# Photoshop

Tools are already named `photoshop_*`. Start with `photoshop_get_state` on the
open document. Stay in Photoshop; do not open Illustrator for a `.psd`.

Exports land in `%LOCALAPPDATA%/UEFN-Ducky/tool_captures/`.

## Document

`photoshop_get_state`, `photoshop_get_document_info`, `photoshop_get_preview`,
`photoshop_get_capabilities`, `photoshop_list_documents`,
`photoshop_set_active_document`, `photoshop_create_document`,
`photoshop_open_image`, `photoshop_save_document`, `photoshop_close_document`,
`photoshop_export_as`, `photoshop_resize_image`, `photoshop_crop_document`,
`photoshop_undo`, `photoshop_redo`, `photoshop_get_history`.

## Layers

`photoshop_get_layers`, `photoshop_select_layer_by_name`, `photoshop_create_layer`,
`photoshop_create_text_layer`, `photoshop_duplicate_layer`, `photoshop_delete_layer`,
`photoshop_rename_layer`, `photoshop_fill_layer`, `photoshop_move_layer`,
`photoshop_move_layer_to_position`, `photoshop_move_layer_to_top`,
`photoshop_move_layer_to_bottom`, `photoshop_move_layer_up`,
`photoshop_move_layer_down`, `photoshop_scale_layer`, `photoshop_rotate_layer`,
`photoshop_fit_layer_to_document`, `photoshop_set_layer_opacity`,
`photoshop_set_layer_blend_mode`, `photoshop_set_layer_visibility`,
`photoshop_set_layer_locked`, `photoshop_rasterize_layer`,
`photoshop_merge_visible_layers`, `photoshop_flatten_image`,
`photoshop_place_image`, `photoshop_apply_layer_style`.

## Pixels and color

`photoshop_adjust_brightness_contrast`, `photoshop_adjust_hue_saturation`,
`photoshop_adjust_curves`, `photoshop_adjust_vibrance`, `photoshop_adjust_exposure`,
`photoshop_auto_levels`, `photoshop_auto_contrast`, `photoshop_desaturate`,
`photoshop_invert`, `photoshop_apply_lut`, `photoshop_apply_photo_filter`,
`photoshop_apply_gradient_map`, `photoshop_apply_gaussian_blur`,
`photoshop_apply_sharpen`, `photoshop_apply_noise`, `photoshop_apply_motion_blur`,
`photoshop_apply_high_pass`, `photoshop_apply_smart_blur`,
`photoshop_generative_upscale`, `photoshop_generate_image`,
`photoshop_sky_replacement`.

## Selection, masks, smart objects

`photoshop_get_selection_bounds`, `photoshop_select_rectangle`,
`photoshop_select_ellipse`, `photoshop_select_all`, `photoshop_deselect`,
`photoshop_invert_selection`, `photoshop_expand_selection`,
`photoshop_contract_selection`, `photoshop_feather_selection`,
`photoshop_save_selection`, `photoshop_select_subject`,
`photoshop_create_layer_mask`, `photoshop_delete_layer_mask`,
`photoshop_apply_layer_mask`, `photoshop_apply_gradient_mask`,
`photoshop_create_clipping_mask`, `photoshop_release_clipping_mask`,
`photoshop_content_aware_fill`, `photoshop_convert_to_smart_object`,
`photoshop_replace_smart_object_contents`, `photoshop_edit_smart_object_contents`,
`photoshop_create_smart_object_via_copy`, `photoshop_image_stack`.

## Type, datasets, actions

`photoshop_list_fonts`, `photoshop_set_text_font`, `photoshop_set_text_color`,
`photoshop_set_text_alignment`, `photoshop_update_text_content`,
`photoshop_list_datasets`, `photoshop_import_datasets`,
`photoshop_generate_from_datasets`, `photoshop_play_action`,
`photoshop_execute_script`.

## Recipes

Prefer a recipe when it matches the job. Each one is still a `photoshop_*` tool:

`recipe_remove_background`, `recipe_enhance_portrait`, `recipe_prepare_for_web`,
`recipe_export_social_variants`, `recipe_apply_color_grade`,
`recipe_frequency_separation`, `recipe_batch_mockup_replace`,
`recipe_organize_layers`, `recipe_gradient_fade`, `recipe_sky_blend`,
`recipe_dodge_burn`, `recipe_remove_distraction`, `recipe_split_carousel`,
`recipe_batch_watermark`, `recipe_passport_photo`, `recipe_csv_to_cards`.

`adobe_list_tools` is the live census if a name above is missing.
