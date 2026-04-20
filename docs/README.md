# DTWare Documentation

This repository hosts the DTWare documentation source and generated API reference material.


## Prerequisites

DTWare uses [MkDocs](https://www.mkdocs.org/) to convert [Markdown](https://www.mkdocs.org/user-guide/writing-your-docs/#writing-with-markdown) format `.md` files into HTML suitable for viewing in a web browser.

!!! info "Prerequisites"
    To build and serve this documentation locally (e.g. for development), you will need:

    * Python 3 installed on your system.
    * An existing DTWare installation containing the virtual environment that was created during installation.

    These instructions assume you have a DTWare deployment user, a home directory at `/home/inventree`, the DTWare source code cloned into `/home/inventree/src`, and a virtual environment at `/home/inventree/env`. If you installed DTWare another way, adjust these instructions accordingly.

!!! warning "Your DTWare install will be updated!"
    Some of the commands that follow will make changes to your install, for example, by running any pending database migrations. There's a small risk this may cause issues with your existing installation. If you can't risk this, consider setting up a separate DTWare installation specifically for documentation development.

## Building the documentation locally

To build the documentation locally, run these commands as the `inventree` user:

```
$ cd /home/inventree
$ source env/bin/activate
```

!!! info "(env) prefix"
    The shell prompt should now display the `(env)` prefix, showing that you are operating within the context of the python virtual environment

You can now install the additional packages needed by mkdocs:

```
$ cd src
$ pip install --require-hashes -r docs/requirements.txt
```

## Schema generation

Building the documentation requires extracting the API schema from the source code.

!!! tip
    This command is only required when building the documentation for the first time, or when changes have been made to the API schema.

```
$ invoke build-docs
```

You will see output similar to this (truncated for brevity):
```
Running DTWare database migrations...
Exporting definitions...
Exporting settings definition to '/home/inventree/src/docs/generated/inventree_settings.json'...
Exported DTWare settings definitions to '/home/inventree/src/docs/generated/inventree_settings.json'
Exported DTWare tag definitions to '/home/inventree/src/docs/generated/inventree_tags.yml'
Exported DTWare filter definitions to '/home/inventree/src/docs/generated/inventree_filters.yml'
Exported DTWare report context definitions to '/home/inventree/src/docs/generated/inventree_report_context.json'
Exporting definitions complete
Exporting schema file to '/home/inventree/src/docs/generated/schema.yml'

Schema export completed: /home/inventree/src/docs/generated/schema.yml
Documentation build complete, but mkdocs not requested
```

## Viewing the documentation

Generate the HTML files from the markdown source files, and start the MkDocs webpage server:

```
$ mkdocs serve -f docs/mkdocs.yml
```

You can then point your web browser at http://localhost:8080/

Alternatively, you can use the `invoke` command:

```
$ invoke dev.docs-server
```

If you need to, use the `-a` option after `mkdocs` or `invoke` to set the address and port.  Run `invoke dev.docs-server --help` for details.

## Editing the Documentation Files

Once the server is running, it will monitor the documentation files for changes, and regenerate the HTML pages as required.  Refresh your web browser to see the changes.

### Admonitions

"Admonition" blocks can be added to the documentation source as follows:
```
!!! info "This is the admonition block title"
    This is the admonition block content
```

Refer to the [reference documentation](https://squidfunk.github.io/mkdocs-material/reference/admonitions/) to customize the admonition block to the use-case (eg. warning, missing, info, etc.).

### Internal Links

Links to internal documentation pages **must** use relative pathing, otherwise the link will be broken by the readthedocs URL formatting.

Also, linking to an internal page must use the `.md` suffix!

For example, to link to the page `/part/views` from `/stock/stocktake`, the link must be formed as follows:

```
Click [here](../part/views.md)
```

*Formatting the link as follows:*

```
Click [here](/part/views)
```

*will result in a broken link.*

### Images

Images are served from the `./docs/assets/images` folder and can be added as follows:

```
{{ image("image_name.png", base="subfolder", title="Image title") }}
```

See the `image` macro in `./docs/main.py` for more information.

### Icons

Icons can be rendered (using the [tabler icon set](https://tabler.io/icons)) as follows:

```
{{ icon("brand-github", color="red")}}
```

See the `icon` macro in `./docs/main.py` for more information.


### Global variables

Refer to the [reference documentation](https://squidfunk.github.io/mkdocs-material/reference/variables/#using-custom-variables) to find out how to add global variables to the documentation site.

Global variables should be added in the `# Global Variables` section of the `mkdocs.yml` configuration file.

## Credits

This documentation makes use of the [mkdocs-material template](https://github.com/squidfunk/mkdocs-material)
