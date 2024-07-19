use leptos::ev;
use leptos::*;
use leptos_use::{use_drop_zone_with_options, UseDropZoneOptions, UseDropZoneReturn};
use uuid::Uuid;

#[component]
pub fn FileInput(
    #[prop(into, default = "Drag and drop files here".to_owned())] title: String,
    #[prop(into, default = "PNG, JPG SVG, WEBP, and GIF are Allowed.".to_owned())]
    sub_title: String,
    #[prop(optional)] on_files_change: Option<WriteSignal<Vec<web_sys::File>>>,
) -> impl IntoView {
    let input_id = Uuid::new_v4().to_string();

    let input_element: NodeRef<html::Input> = create_node_ref();
    let on_input_change = move |e: ev::Event| {
        e.prevent_default();
        let value: &web_sys::HtmlInputElement = &input_element.get().unwrap();
        if let (Some(file_list), Some(setter)) = (value.files(), on_files_change) {
            setter.update(|old_files| {
                for i in 0..file_list.length() {
                    if let Some(file) = file_list.item(i) {
                        old_files.push(file);
                    }
                }
            });
        }
    };

    let drop_zone_el = create_node_ref::<html::Div>();
    let UseDropZoneReturn {
        is_over_drop_zone, ..
    } = use_drop_zone_with_options(
        drop_zone_el,
        UseDropZoneOptions::default().on_drop(move |event| {
            if let Some(setter) = on_files_change {
                setter.update(|old_files| {
                    old_files.extend(event.files);
                });
            }
        }),
    );

    view! {
        <div
            for=input_id.clone()
            class="bg-gray-50 text-center px-4 rounded w-full h-80 flex flex-col items-center justify-center cursor-pointer border-2 border-gray-400 border-dashed font-[sans-serif]"
            class:border-blue-600=move || is_over_drop_zone.get()
            node_ref=drop_zone_el
        >
            <div class="py-6">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-10 mb-2 fill-gray-600 inline-block"
                    viewBox="0 0 32 32"
                >
                    <path
                        d="M23.75 11.044a7.99 7.99 0 0 0-15.5-.009A8 8 0 0 0 9 27h3a1 1 0 0 0 0-2H9a6 6 0 0 1-.035-12 1.038 1.038 0 0 0 1.1-.854 5.991 5.991 0 0 1 11.862 0A1.08 1.08 0 0 0 23 13a6 6 0 0 1 0 12h-3a1 1 0 0 0 0 2h3a8 8 0 0 0 .75-15.956z"
                        data-original="#000000"
                    ></path>
                    <path
                        d="M20.293 19.707a1 1 0 0 0 1.414-1.414l-5-5a1 1 0 0 0-1.414 0l-5 5a1 1 0 0 0 1.414 1.414L15 16.414V29a1 1 0 0 0 2 0V16.414z"
                        data-original="#000000"
                    ></path>
                </svg>
                <h4 class="text-base font-semibold text-gray-600">{title}</h4>
            </div>

            <hr class="w-full border-gray-400 my-2"/>

            <div class="py-6">
                <input
                    id=input_id.clone()
                    type="file"
                    class="hidden"
                    on:change=on_input_change
                    node_ref=input_element
                />
                <label
                    for=input_id.clone()
                    class="block px-6 py-2.5 rounded text-gray-600 text-sm tracking-wider cursor-pointer font-semibold border-none outline-none bg-gray-200 hover:bg-gray-100"
                >
                    Browse
                    Files
                </label>
                <p class="text-xs text-gray-400 mt-4">{sub_title}</p>
            </div>
        </div>
    }
}
