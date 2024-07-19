use leptos::*;

mod components;
mod helia;

use components::{file_input, file_progress};
use helia::get_helia;
use leptos::logging::log;

fn main() {
    console_error_panic_hook::set_once();

    mount_to_body(|| {
        let (files, set_files) = create_signal(vec![]);

        let h = get_helia();
        log!("{:?}", h);

        let _ = create_resource(files, |mut f| async move {
            let _files: Vec<_> = f.drain(..).collect();
        });

        view! {
            <div class="grid sm:grid-cols-2 gap-12 max-w-3xl mx-auto p-4 min-h-screen content-center">

                <file_input::FileInput on_files_change=set_files></file_input::FileInput>
                <div>
                    <h4 class="text-base text-gray-600 font-semibold">Uploading</h4>
                    <div class="space-y-8 mt-4">
                        <div class="flex flex-col">
                            <div class="flex mb-2">
                                <p class="text-sm text-gray-500 font-semibold flex-1">
                                    Photo2.jpg <span class="ml-2">2.5 mb</span>
                                </p>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="w-3 cursor-pointer shrink-0 fill-black hover:fill-red-500"
                                    viewBox="0 0 320.591 320.591"
                                >
                                    <path
                                        d="M30.391 318.583a30.37 30.37 0 0 1-21.56-7.288c-11.774-11.844-11.774-30.973 0-42.817L266.643 10.665c12.246-11.459 31.462-10.822 42.921 1.424 10.362 11.074 10.966 28.095 1.414 39.875L51.647 311.295a30.366 30.366 0 0 1-21.256 7.288z"
                                        data-original="#000000"
                                    ></path>
                                    <path
                                        d="M287.9 318.583a30.37 30.37 0 0 1-21.257-8.806L8.83 51.963C-2.078 39.225-.595 20.055 12.143 9.146c11.369-9.736 28.136-9.736 39.504 0l259.331 257.813c12.243 11.462 12.876 30.679 1.414 42.922-.456.487-.927.958-1.414 1.414a30.368 30.368 0 0 1-23.078 7.288z"
                                        data-original="#000000"
                                    ></path>
                                </svg>
                            </div>
                            <div class="bg-gray-300 rounded-full w-full h-2.5">
                                <div class="w-2/3 h-full rounded-full bg-blue-600 flex items-center relative">
                                    <span class="absolute text-xs right-0.5 bg-white w-2 h-2 rounded-full"></span>
                                </div>
                            </div>
                            <p class="text-sm text-gray-500 font-semibold flex-1 mt-2">70% done</p>
                        </div>
                        <div class="flex flex-col">
                            <div class="flex mb-2">
                                <p class="text-sm text-gray-500 font-semibold flex-1">
                                    Photo3.png <span class="ml-2">2.9 mb</span>
                                </p>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="w-3 cursor-pointer shrink-0 fill-black hover:fill-red-500"
                                    viewBox="0 0 320.591 320.591"
                                >
                                    <path
                                        d="M30.391 318.583a30.37 30.37 0 0 1-21.56-7.288c-11.774-11.844-11.774-30.973 0-42.817L266.643 10.665c12.246-11.459 31.462-10.822 42.921 1.424 10.362 11.074 10.966 28.095 1.414 39.875L51.647 311.295a30.366 30.366 0 0 1-21.256 7.288z"
                                        data-original="#000000"
                                    ></path>
                                    <path
                                        d="M287.9 318.583a30.37 30.37 0 0 1-21.257-8.806L8.83 51.963C-2.078 39.225-.595 20.055 12.143 9.146c11.369-9.736 28.136-9.736 39.504 0l259.331 257.813c12.243 11.462 12.876 30.679 1.414 42.922-.456.487-.927.958-1.414 1.414a30.368 30.368 0 0 1-23.078 7.288z"
                                        data-original="#000000"
                                    ></path>
                                </svg>
                            </div>
                            <div class="bg-gray-300 rounded-full w-full h-2.5">
                                <div class="w-11/12 h-full rounded-full bg-blue-600 flex items-center relative">
                                    <span class="absolute text-xs right-0.5 bg-white w-2 h-2 rounded-full"></span>
                                </div>
                            </div>
                            <p class="text-sm text-gray-500 font-semibold flex-1 mt-2">90% done</p>
                        </div>
                    </div>
                </div>
            </div>
        }
    })
}
