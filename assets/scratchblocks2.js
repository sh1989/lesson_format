/*
 * scratchblocks2
 * http://github.com/blob8108/scratchblocks2
 *
 * Copyright 2013, Tim Radvan
 * @license MIT
 * http://opensource.org/licenses/MIT
 */
var scratchblocks2 = function($) {
	"use strict";
	var sb2 = {}, BRACKETS = "([<)]>",
		MATH_FUNCTIONS = ["abs", "floor", "ceiling", "sqrt", "sin", "cos", "tan", "asin", "acos", "atan", "ln", "log", "e^", "10^"],
		DATA_INSERTS = ["string", "dropdown", "number", "number-dropdown", "color"],
		ARG_SHAPES = ["reporter", "embedded", "boolean", "string", "dropdown", "number", "number-dropdown", "list-dropdown", "math-function"],
		CLASSES = {
			misc: ["scratchblocks2-container", "script", "empty", "list-dropdown"],
			comments: ["comment", "attached", "to-hat", "to-reporter"],
			internal: ["math-function"],
			shape: ["hat", "cap", "stack", "embedded", "reporter", "boolean", "string", "dropdown", "number", "number-dropdown", "color", "custom-definition", "custom-arg", "outline", "cstart", "cmouth", "cwrap", "celse", "cend", "ifblock", "capend"],
			category: ["obsolete", "control", "custom", "events", "list", "looks", "motion", "operators", "pen", "sensing", "sound", "variables", "purple"]
		}, all_classes, blocks_db, blocks_original;

	function log(message) {
		if (window.console !== undefined) {
			window.console.log(message)
		}
	}

	function assert(bool) {
		if (!bool) {
			log("Assertion failed!")
		}
	}

	function is_class(name) {
		if (all_classes === undefined) {
			all_classes = [];
			$.each(CLASSES, function(i, classes_group) {
				all_classes = all_classes.concat(classes_group)
			})
		}
		return $.inArray(name, all_classes) > -1
	}

	function cls(name) {
		if (!is_class(name)) {
			log("Invalid class: " + name)
		}
		return name
	}

	function is_open_bracket(chr) {
		var bracket_index = BRACKETS.indexOf(chr);
		return -1 < bracket_index && bracket_index < 3
	}

	function is_close_bracket(chr) {
		return 2 < BRACKETS.indexOf(chr)
	}

	function get_matching_bracket(chr) {
		return BRACKETS[BRACKETS.indexOf(chr) + 3]
	}

	function is_lt_gt(code, index) {
		var chr, i;
		if (code[index] !== "<" && code[index] !== ">" || index === code.length || index === 0) {
			return false
		}
		if (/^whendistance$/i.test(strip_block_text(code.substr(0, index)))) {
			return true
		}
		for (i = index + 1; i < code.length; i++) {
			chr = code[i];
			if (is_open_bracket(chr)) {
				break
			}
			if (chr !== " ") {
				return false
			}
		}
		for (i = index - 1; i > -1; i--) {
			chr = code[i];
			if (is_close_bracket(chr)) {
				break
			}
			if (chr !== " ") {
				return false
			}
		}
		return true
	}

	function strip_brackets(code) {
		if (is_open_bracket(code[0])) {
			var bracket = code[0];
			if (code[code.length - 1] === get_matching_bracket(bracket)) {
				code = code.substr(0, code.length - 1)
			}
			code = code.substr(1)
		}
		return code
	}

	function split_into_pieces(code) {
		var pieces = [],
			piece = "",
			matching_bracket = "",
			nesting = [],
			chr, i;
		for (i = 0; i < code.length; i++) {
			chr = code[i];
			if (nesting.length > 0) {
				piece += chr;
				if (is_open_bracket(chr) && !is_lt_gt(code, i) && nesting[nesting.length - 1] !== "[") {
					nesting.push(chr);
					matching_bracket = get_matching_bracket(chr)
				} else if (chr === matching_bracket && !is_lt_gt(code, i)) {
					nesting.pop();
					if (nesting.length === 0) {
						pieces.push(piece);
						piece = ""
					} else {
						matching_bracket = get_matching_bracket(nesting[nesting.length - 1])
					}
				}
			} else {
				if (is_open_bracket(chr) && !is_lt_gt(code, i)) {
					nesting.push(chr);
					matching_bracket = get_matching_bracket(chr);
					if (piece) {
						pieces.push(piece)
					}
					piece = ""
				}
				piece += chr
			}
		}
		if (piece) {
			pieces.push(piece)
		}
		return pieces
	}

	function get_block_category($block) {
		var block_category;
		$.each(CLASSES.category, function(i, category) {
			if ($block.hasClass(cls(category))) {
				block_category = category
			}
		});
		return block_category
	}

	function get_arg_shape($arg) {
		if (!$arg) {
			return ""
		}
		var arg_shape;
		$.each(ARG_SHAPES, function(i, shape) {
			if ($arg.hasClass(cls(shape))) {
				arg_shape = shape
			}
		});
		return arg_shape
	}

	function strip_block_text(text) {
		var map = diacritics_removal_map,
			i;
		text = text.replace(/[ ,%?:]/g, "").toLowerCase();
		text = text.replace("ß", "ss");
		for (i = 0; i < map.length; i++) {
			text = text.replace(map[i].letters, map[i].base)
		}
		return text
	}

	function get_block_text($block) {
		$block.children().remove();
		return strip_block_text($block.text())
	}

	function hex2rgb(hexStr) {
		var hex, r, g, b;
		assert(hexStr[0] === "#");
		hexStr = hexStr.substring(1);
		if (hexStr.length === 3) {
			r = hexStr[0];
			g = hexStr[1];
			b = hexStr[2];
			hexStr = r + r + g + g + b + b
		}
		hex = parseInt(hexStr, 16);
		if (hexStr.length === 6) {
			r = (hex & 16711680) >> 16;
			g = (hex & 65280) >> 8;
			b = hex & 255
		}
		return [r, g, b]
	}

	function clamp(x, a, b) {
		return Math.min(b, Math.max(x, a))
	}

	function scale_color(rgb, scale) {
		var r = rgb[0],
			g = rgb[1],
			b = rgb[2];
		r = Math.round(clamp(r * scale, 0, 255));
		g = Math.round(clamp(g * scale, 0, 255));
		b = Math.round(clamp(b * scale, 0, 255));
		return [r, g, b]
	}

	function rgb2css(rgb) {
		var r = rgb[0],
			g = rgb[1],
			b = rgb[2];
		return "rgb(" + r + ", " + g + ", " + b + ") "
	}

	function apply_block_color($block, hexColor) {
		var rgb = hex2rgb(hexColor);
		var btop = rgb2css(scale_color(rgb, 1.4));
		var bbot = rgb2css(scale_color(rgb, .7));
		$block.css({
			"background-color": rgb2css(rgb),
			"border-top-color": btop,
			"border-left-color": btop,
			"border-bottom-color": bbot,
			"border-right-color": bbot
		})
	}

	function load_blocks_db() {
		var db = {}, category = "";
		$.each(sb2.blocks.split(/ {2}|\n|\r/), function(i, line) {
			line = line.trim();
			if (line.length === 0) {
				return
			}
			var classes = [category],
				commentIndex = line.indexOf("##"),
				extra, $block, arg_shapes, text, block;
			if (commentIndex === 0) {
				category = line.replace(/##/g, "").trim().toLowerCase();
				return
			}
			if (commentIndex > 0) {
				extra = line.substr(commentIndex + 2).trim();
				line = line.substr(0, commentIndex);
				line = line.trim();
				classes = classes.concat(extra.split(" "))
			}
			$block = render_block(line, "database:stack");
			arg_shapes = [];
			$block.children().each(function(i, arg) {
				arg_shapes.push(get_arg_shape($(arg)))
			});
			$block.children().remove();
			text = $block.text();
			text = strip_block_text(text);
			block = [classes, arg_shapes];
			if (db[text] === undefined) {
				if (text == "") debugger;
				db[text] = []
			}
			db[text].push(block)
		});
		blocks_db = db;
		sb2.blocks_db = blocks_db;
		blocks_original = sb2.blocks
	}

	function get_blocks_db() {
		if (blocks_original === undefined || blocks_original !== sb2.blocks) {
			load_blocks_db();
			log("Parsed blocks db.")
		}
		return blocks_db
	}

	function find_block(text, $arg_list) {
		text = strip_block_text(text);
		var blocks = get_blocks_db(),
			block, poss_blocks, classes = [],
			arg_classes = [];
		poss_blocks = blocks[text];
		if (poss_blocks !== undefined) {
			block = poss_blocks[0];
			if (poss_blocks.length > 1) {
				$.each(poss_blocks, function(i, poss_block) {
					var category = poss_block[0][0],
						need_args = poss_block[1],
						fits = true,
						$arg, arg_shape, j;
					for (j = 0; j < need_args.length; j++) {
						$arg = $arg_list[j];
						arg_shape = get_arg_shape($arg);
						if (arg_shape !== need_args[j]) {
							if (need_args[j] === "math-function") {
								var func = $arg.text().replace(/[ ]/g, "").toLowerCase();
								if ($.inArray(func, MATH_FUNCTIONS) === -1) {
									fits = false;
									break
								}
							} else if (!((arg_shape === "reporter" || arg_shape === "embedded") && (need_args[j] === "number" || need_args[j] === "string"))) {
								fits = false;
								break
							}
						}
					}
					if (fits) {
						block = poss_block
					}
				})
			}
		}
		if (block === undefined) {
			if (/^[when|quand|Wenn].*[clicked|pressé|angeklickt]$/.test(text)) {
				if (blocks["whenthisspriteclicked"]) {
					block = blocks["whenthisspriteclicked"][0]
				}
			}
		}
		if (block) {
			classes = block[0];
			$.each(block[1], function(i, shape) {
				if (shape === "list-dropdown" || shape === "math-function") {
					arg_classes.push(shape)
				} else {
					arg_classes.push("")
				}
			})
		}
		return [classes, arg_classes]
	}

	function render_block(code, need_shape) {
		var $block = $("<div>"),
			shape, is_database = false,
			category = "",
			bracket = "",
			is_dropdown = false,
			pieces = [],
			text = "",
			classes = [];
		if (/^database:?/.test(need_shape)) {
			is_database = true;
			need_shape = need_shape.substr(9)
		}
		if (need_shape === undefined) {
			need_shape = ""
		}
		shape = need_shape;
		code = code.trim();
		if (code === "") {
			return
		}
		if (need_shape === "stack" && split_into_pieces(code).length > 1) {} else {
			if (is_open_bracket(code[0])) {
				bracket = code[0];
				code = strip_brackets(code)
			}
			if (bracket !== "[") {
				code = code.trim()
			}
		} if (/^define/i.test(code)) {
			shape = "custom-definition";
			code = code.substr(6).trim()
		}
		if (bracket === "[") {
			pieces = [code]
		} else {
			pieces = split_into_pieces(code)
		} if (shape !== "custom-definition") {
			if (pieces.length > 1) {
				switch (bracket) {
					case "(":
						shape = "embedded";
						break;
					case "<":
						shape = "boolean";
						break;
					default:
						assert(shape === "stack");
						break
				}
			} else {
				switch (bracket) {
					case "(":
						if (/^(-?[0-9.]+( v)?)?$/i.test(code)) {
							shape = "number";
							if (/ v$/i.test(code)) {
								is_dropdown = true;
								code = code.substr(0, code.length - 2);
								shape = "number-dropdown"
							}
						} else if (/ v$/i.test(code)) {
							is_dropdown = true;
							code = code.substr(0, code.length - 2);
							shape = "number-dropdown"
						} else {
							shape = "reporter"
						}
						break;
					case "[":
						if (/^#[A-Fa-f0-9]{3,6}$/.test(code)) {
							shape = "color"
						} else {
							shape = "string";
							if (/ v$/i.test(code)) {
								is_dropdown = true;
								code = code.substr(0, code.length - 2);
								shape = "dropdown"
							}
						}
						break;
					case "<":
						shape = "boolean";
						category = "operators";
						break;
					default:
						break
				}
			}
		}
		if (shape === "reporter") {
			if (pieces.length === 1 && !is_open_bracket(pieces[0][0])) {
				category = "variables"
			} else {
				shape = "embedded"
			}
		}
		$block.addClass(cls(shape));
		if (code.length === 0) {
			code = " ";
			pieces = [code];
			$block.addClass(cls("empty"))
		}
		if (shape === "color") {
			$block.css({
				"background-color": code
			});
			$block.text(" ");
			return $block
		}

		function is_block(piece) {
			return piece.length > 1 && (is_open_bracket(piece[0]) || is_close_bracket(piece[0]))
		}
		$.each(pieces, function(i, piece) {
			if (!is_block(piece)) {
				text += piece
			}
		});
		var $arg_list = [];
		if (shape === "custom-definition") {
			$block.append("define");
			var $outline = $("<div>").addClass(cls("outline"));
			$block.append($outline);
			$.each(pieces, function(i, piece) {
				if (is_block(piece)) {
					var $arg = $("<div>").addClass(cls("custom-arg"));
					if (piece[0] === "<") {
						$arg.addClass(cls("boolean"))
					}
					$arg.text(strip_brackets(piece));
					$outline.append($arg)
				} else {
					$outline.append(piece)
				}
			})
		} else if (pieces.length === 1) {
			$block.text(code)
		} else {
			$.each(pieces, function(i, piece) {
				var $arg;
				if (is_block(piece)) {
					if (is_database) {
						$arg = render_block(piece, "database")
					} else {
						$arg = render_block(piece)
					}
					$block.append($arg);
					$arg_list.push($arg)
				} else {
					$block.append(piece)
				} if (is_database) {
					if (piece === "[list v]") {
						$arg.addClass(cls("list-dropdown"))
					}
					if (piece === "[sqrt v]") {
						$arg.addClass(cls("math-function"))
					}
				}
			})
		} if (shape === "custom-definition") {
			$block.addClass(cls("custom"))
		} else if ($.inArray(shape, DATA_INSERTS) > -1) {} else {
			var arg_classes = [],
				info;
			if (!is_database) {
				info = find_block(text, $arg_list);
				classes = info[0];
				arg_classes = info[1]
			}
			if (classes.length === 0) {
				if (category !== "") {
					$block.addClass(cls(category))
				} else {
					$block.addClass(cls("obsolete"))
				}
			} else {
				$.each(classes, function(i, name) {
					if (!/^-/.test(name)) {
						$block.addClass(cls(name))
					}
				});
				$.each(arg_classes, function(i, name) {
					var $arg = $arg_list[i];
					if ($arg && name) {
						if (name === "list-dropdown" && !$arg.hasClass("dropdown")) {} else {
							$arg.addClass(name)
						}
					}
				})
			}
		}

		function replace_text_with_image(regex, image_class) {
			var html = $block.html(),
				image = '<span class="' + image_class + '"></span>';
			html = html.replace(regex, image);
			$block.html(html)
		}
		if ($.inArray("-green-flag", classes) > -1) {
			replace_text_with_image(/green flag|flag|gf/i, "green-flag")
		}
		if ($.inArray("-turn-arrow", classes) > -1) {
			if (/ccw|left/i.test(text)) {
				replace_text_with_image(/ccw|left/i, "arrow-ccw")
			} else {
				replace_text_with_image(/cw|right/i, "arrow-cw")
			}
		}
		if ($block.hasClass(cls("cend"))) {
			var html = $block.html();
			$block.html("").append($("<span>").html(html))
		}
		if (need_shape === "stack" && $.inArray(shape, DATA_INSERTS) > -1) {
			var $insert = $block;
			$block = $("<div>").addClass(cls("stack")).addClass(cls("obsolete")).append($insert)
		}
		return $block
	}

	function render_comment(text) {
		var $comment = $("<div>").addClass(cls("comment")).append($("<div>").text(text.trim()));
		return $comment
	}

	function render(code) {
		var scripts = [],
			$script, $current, nesting = 0,
			lines = code.split(/\n/),
			line, $block, $cwrap, $cmouth, $comment, $last_comment, comment_text, one_only, $first, i;

		function add_cend($block, do_comment) {
			$cmouth = $current;
			$cwrap = $cmouth.parent();
			assert($cwrap.hasClass(cls("cwrap")));
			$cwrap.append($block);
			$current = $cwrap.parent();
			nesting -= 1;
			if ($comment && do_comment) {
				$cwrap.append($comment);
				$comment = null
			}
			$block.removeClass(get_block_category($block));
			$block.addClass(get_block_category($cwrap));
			if ($cmouth.find("> :last-child").hasClass("cap")) {
				$block.addClass(cls("capend"))
			}
		}

		function new_script() {
			while (nesting > 0) {
				var $cend = $("<div><span>end</span></div>").addClass(cls("stack")).addClass(cls("cend")).addClass(cls("control"));
				add_cend($cend, false)
			}
			if ($script !== undefined && $script.children().length > 0) {
				scripts.push($script)
			}
			$script = $("<div>").addClass(cls("script"));
			$current = $script;
			nesting = 0;
			$last_comment = null
		}
		new_script();
		for (i = 0; i < lines.length; i++) {
			line = lines[i];
			if (line.trim() === "" && nesting === 0) {
				new_script();
				continue
			}
			$comment = null;
			comment_text = null;
			if (line.indexOf("//") > -1) {
				comment_text = line.substr(line.indexOf("//") + 2).trim();
				line = line.substr(0, line.indexOf("//"))
			}
			$block = render_block(line, "stack");
			if ($block) {
				$last_comment = null
			}
			if (comment_text) {
				if ($last_comment) {
					$last_comment.children().text($last_comment.children().text() + "\n" + comment_text)
				} else {
					$comment = render_comment(comment_text)
				}
			}
			if ($block) {
				one_only = false;
				if ($block.hasClass(cls("hat")) || $block.hasClass(cls("custom-definition"))) {
					new_script();
					if ($comment) {
						$comment.addClass(cls("to-hat"));
						if ($block.hasClass(cls("custom-definition"))) {
							$comment.addClass(cls("to-custom-definition"))
						}
					}
				} else if ($block.hasClass(cls("boolean")) || $block.hasClass(cls("embedded")) || $block.hasClass(cls("reporter"))) {
					new_script();
					one_only = true;
					if ($comment) {
						$comment.addClass(cls("to-reporter"))
					}
				}
				if ($comment) {
					$comment.addClass(cls("attached"))
				}
				if ($block.hasClass(cls("cstart"))) {
					$cwrap = $("<div>").addClass(cls("cwrap"));
					$current.append($cwrap);
					$cwrap.append($block);
					if ($comment) {
						$cwrap.append($comment);
						$comment = null
					}
					$cmouth = $("<div>").addClass(cls("cmouth"));
					$cwrap.append($cmouth);
					$current = $cmouth;
					$cwrap.addClass(get_block_category($block));
					if ($block.hasClass(cls("cap"))) {
						$cwrap.addClass(cls("cap"));
						$block.removeClass(cls("cap"))
					}
					nesting += 1
				} else if ($block.hasClass(cls("celse"))) {
					if (nesting > 0) {
						$cwrap = $current.parent();
						assert($cwrap.hasClass(cls("cwrap")));
						$cwrap.append($block);
						if ($comment) {
							$cwrap.append($comment);
							$comment = null
						}
						$cmouth = $cwrap.find("." + cls("cmouth"));
						if ($cmouth.find("> :last-child").hasClass("cap")) {
							$block.addClass(cls("capend"))
						}
						$cmouth = $("<div>").addClass(cls("cmouth"));
						$cwrap.append($cmouth);
						$current = $cmouth;
						$block.removeClass(get_block_category($block));
						$block.addClass(get_block_category($cwrap))
					} else {
						$current.append($block)
					}
				} else if ($block.hasClass(cls("cend"))) {
					if (nesting > 0) {
						add_cend($block, true);
						if (nesting === 0 && $cwrap.hasClass("cap")) {
							new_script()
						}
					} else {
						$current.append($block)
					}
				} else {
					$current.append($block)
				} if ($comment) {
					$current.append($comment)
				}
				if (one_only || nesting === 0 && $block.hasClass("cap")) {
					new_script()
				}
			} else {
				if ($comment) {
					if (nesting > 0) {
						$current.append($comment)
					} else {
						new_script();
						$current.append($comment);
						new_script()
					}
				}
			} if ($comment) {
				$last_comment = $comment
			}
		}
		new_script();
		var list_names = [],
			custom_blocks_text = [];
		for (i = 0; i < scripts.length; i++) {
			$script = scripts[i];
			$script.find(".list-dropdown").each(function(i, list) {
				var list_name = $(list).text();
				list_names.push(list_name)
			})
		}
		for (i = 0; i < scripts.length; i++) {
			$script = scripts[i];
			var custom_arg_names = [];
			$first = $script.children().first();
			if ($first.hasClass("custom-definition")) {
				$first.find(".custom-arg").each(function(i, arg) {
					custom_arg_names.push($(arg).text())
				});
				custom_blocks_text.push(get_block_text($first.find(".outline").clone()))
			}
			$script.find(".variables.reporter").each(function(i, variable) {
				var $variable = $(variable);
				var var_name = $variable.text();
				if ($.inArray(var_name, custom_arg_names) > -1) {
					$variable.removeClass(cls("variables")).addClass(cls("custom-arg"))
				} else if ($.inArray(var_name, list_names) > -1) {
					$variable.removeClass(cls("variables")).addClass(cls("list"))
				}
			})
		}
		for (i = 0; i < scripts.length; i++) {
			$script = scripts[i];
			$script.find(".obsolete.stack").each(function(i, block) {
				$block = $(block);
				var text = get_block_text($block.clone());
				if ($.inArray(text, custom_blocks_text) > -1) {
					$block.removeClass(cls("obsolete")).addClass(cls("custom"))
				}
			})
		}
		return scripts
	}
	sb2.parse = function(selector) {
		selector = selector || "pre.blocks";
		$(selector).each(function(i, el) {
			var $el = $(el),
				$container = $("<div>"),
				code = $("<pre>" + $el.html().replace(/<br>\s?|\n/gi, "\n") + "</pre>").text(),
				scripts = render(code);
			$el.text("");
			$el.append($container);
			$container.addClass(cls("scratchblocks2-container")), $.each(scripts, function(i, $script) {
				$container.append($script)
			})
		})
	};
	return sb2
}(jQuery);
scratchblocks2.blocks = "## Motion ##\nmove (10) steps\nturn cw (15) degrees ## -turn-arrow\nturn right (15) degrees ## -turn-arrow\nturn ccw (15) degrees ## -turn-arrow\nturn left (15) degrees ## -turn-arrow\npoint in direction (90 v)\npoint towards [ v]\ngo to x: (0) y: (0)\ngo to [mouse-pointer v]\nglide (1) secs to x: (0) y: (0)\nchange x by (10)\nset x to (0)\nchange y by (10)\nset y to (0)\nif on edge, bounce\nset rotation style [left-right v]\n(x position)\n(y position)\n(direction)\n## Looks ##\nsay [Hello!] for (2) secs\nsay [Hello!]\nthink [Hmm...] for (2) secs\nthink [Hmm...]\nshow\nhide\nswitch costume to [costume1 v]\nnext costume\nswitch backdrop to [backdrop1 v]\nchange [color v] effect by (25)\nset [color v] effect to (0)\nclear graphic effects\nchange size by (10)\nset size to (100)%\ngo to front\ngo back (1) layers\n(costume #)\n(backdrop name)\n(size)\n## Stage-specific\n## Looks ##\nswitch backdrop to [backdrop1 v] and wait\nnext backdrop\n(backdrop #)\n## Sound ##\nplay sound [pop v]\nplay sound [pop v] until done\nstop all sounds\nplay drum (1 v) for (0.2) beats\nrest for (0.2) beats\nplay note (60 v) for (0.5) beats\nset instrument to (1 v)\nchange volume by (-10)\nset volume to (100)%\n(volume)\nchange tempo by (20)\nset tempo to (60) bpm\n(tempo)\n## Pen ##\nclear\nstamp\npen down\npen up\nset pen color to [#f0f]\nchange pen color by (10)\nset pen color to (0)\nchange pen shade by (10)\nset pen shade to (50)\nchange pen size by (1)\nset pen size to (1)\n## Variables ##\nset [var v] to [0]\nchange [var v] by (1)\nshow variable [var v]\nhide variable [var v]\n## List ##\nadd [thing] to [list v]\ndelete (1 v) of [list v]\ninsert [thing] at (1 v) of [list v]\nreplace item (1 v) of [list v] with [thing]\n(item (1 v) of [list v])\n(length of [list v])\n<[list v] contains [thing]>\nshow list [list v]\nhide list [list v]\n## Events ##\nwhen gf clicked ## hat -green-flag\nwhen green flag clicked ## hat -green-flag\nwhen flag clicked ## hat -green-flag\nwhen [space v] key pressed ## hat\nwhen this sprite clicked ## hat\nwhen backdrop switches to [backdrop1 v] ## hat\nwhen [loudness v] > (10) ## hat\nwhen I receive [message1 v] ## hat\nbroadcast [message1 v]\nbroadcast [message1 v] and wait\n## Control ##\nwait (1) secs\nrepeat (10) ## cstart\nforever ## cstart cap\nif <> then ## ifblock cstart\nelse ## celse\nend ## cend\nwait until <>\nrepeat until <> ## cstart\nstop [all v] ## cap\nwhen I start as a clone ## hat\ncreate clone of [myself v]\ndelete this clone ## cap\n## Sensing ##\n<touching [ v]?>\n<touching color [#f0f]?>\n<color [#f0f] is touching?>\n(distance to [ v])\nask [What's your name?] and wait\n(answer)\n<key [space v] pressed?>\n<mouse down?>\n(mouse x)\n(mouse y)\n(loudness)\n(video [motion v] on [this sprite v])\nturn video [on v]\nset video transparency to (50)%\n(timer)\nreset timer\n([x position v] of [Sprite1 v])\n(current [minute v])\n(days since 2000)\n(username)\n(user id)\n## Operators ##\n(() + ())\n(() - ())\n(() * ())\n(() / ())\n(pick random (1) to (10))\n<[] < []>\n<[] = []>\n<[] > []>\n<<> and <>>\n<<> or <>>\n<not <>>\n(join [hello ] [world])\n(letter (1) of [world])\n(length of [world])\n(() mod ())\n(round ())\n([sqrt v] of (9))\n## Purple ##\nwhen [button pressed v] ## hat\n<sensor [button pressed v]?>\n([slider v] sensor value)\nturn motor on for (1) secs\nturn motor on\nturn motor off\nset motor power (100)\nset motor direction [this way v]\nwhen distance < (20) ## hat\nwhen tilt = (1) ## hat\n(distance)\n(tilt)\n## Looks ##\nswitch to costume [costume1 v]\nswitch to background [background1 v]\nnext background\n(background #)\n## Control ##\nif <> ## cstart\nforever if <> ## cstart cap\nstop script ## cap\nstop all ## cap\n## Events ##\nwhen clicked ## hat\n## Sensing ##\n<loud?>\n## Purple ##\nmotor on\nmotor off\nmotor on for (1) seconds\nmotor power (100)\nmotor direction [this way v]\n## Motion ##\ngehe (10)er-Schritt\ndrehe dich im Uhrzeigersinn um (15) Grad ## -turn-arrow\ndrehe dich rechts um (15) Grad ## -turn-arrow\ndrehe dich gegen den Uhrzeigersinn um (15) Grad ## -turn-arrow\ndrehe dich links um (15) Grad ## -turn-arrow\nsetze Richtung auf (90 v)\ndrehe dich zu [ v]\nzeige auf [ v]\ngehe zu x: (0) y: (0)\ngehe zu [mouse-pointer v]\ngleite in (1) sek. zu x: (0) y: (0)\nändere x um (10)\nsetze x auf (0)\nändere y um (10)\nsetze y auf (0)\npralle vom Rand ab\nsetzte Drehtyp auf [left-right v]\n(x-Position)\n(y-Position)\n(Richtung)\n## Looks ##\nsage [Hello!] für (2) Sek.\nsage [Hello!]\ndenke [Hmm...] für (2) Sek.\ndenke [Hmm...]\nzeige dich\nverstecke dich\nwechsle zu Kostüm [costume1 v]\nnächstes Kostüm\nwechsle zu Bühnenbild [backdrop1 v]\nändere [color v]-Effekt um (25)\nsetze [color v]-Effekt to (0)\nschalte Grafikeffekte aus\nändere Größe um (10)\nsetze Größe auf (100)%\nkomme nach vorn\ngehe (1) Ebenen nach hinten\n(Kostümnummer)\n(Bühnenbildname)\n(Größe)\n## Stage-specific\n## Looks ##\nwechsle zu Bühnenbild [backdrop1 v] und warte\nnächstes Bühnenbild\n(Bühnenbildnummer)\n## Sound ##\nspiele Klang [pop v]\nspiele Klang [pop v] ganz\nstoppe alle Klänge\nspiele Schlagzeug (1 v) für (0.2) Schläge\npausiere (0.2) Schläge\nspiele Ton (60 v) für (0.5) Schläge\nsetze Instrument auf (1 v)\nändere Lautstärke um (-10)\nsetze Lautstärke auf (100)%\n(Lautstärke)\nändere Tempo um (20)\nsetze Tempo auf (60) Schläge/Minute\n(Tempo)\n## Pen ##\nwische Malspuren weg\nhinterlasse Abdruck\nschalte Stift ein\nschalte Stift aus\nsetze Stiftfarbe auf [#f0f]\nändere Stiftfarbe um (10)\nsetze Stiftfarbe auf (0)\nändere Farbstärke um (10)\nsetze Farbstärke auf (50)\nändere Stiftdicke um (1)\nsetze Stiftdicke auf (1)\n## Variables ##\nsetze [var v] auf [0]\nändere [var v] um (1)\nzeige Variable [var v]\nverstecke Variable [var v]\n## List ##\nfüge [thing] zu [list v]\nentferne (1 v) aus [list v]\nfüge [thing] als (1 v) in [list v] ein\nersetze (1 v) Element von [list v] durch [thing]\n(Element (1 v) von [list v])\n(Länge von [list v])\n<[list v] enthält [thing]>\nzeige Liste [list v]\nverstecke Liste [list v]\n## Events ##\nWenn gf angeklickt ## hat -green-flag\nWenn grüne Flagge angeklickt ## hat -green-flag\nWenn Flagge angeklickt ## hat -green-flag\nWenn Taste [space v] gedrückt ## hat\nWenn dieses Objekt angeklickt ## hat\nWenn das Bühnenbild zu [backdrop1 v] ## hat\nWenn [loudness v] > (10) ## hat\nWenn ich [message1 v] empfange ## hat\nsende [message1 v] an alle\nsende [message1 v] an alle und warte\n## Control ##\nwarte (1) Sek.\nwiederhole (10) mal ## cstart\nwiederhole fortlaufend ## cstart\nfalls <> dann ## ifblock cstart\nsonst ## celse\nende ## cend\nwarte bis <>\nwiederhole bis <> ## cstart\nstoppe [all v] ## cap\nWenn ich als Klon entstehe ## hat\nerzeuge Klon von [myself v]\nlösche diesen Klon ## cap\n## Sensing ##\n<wird [ v] berührt?>\n<wird Farbe [#f0f] berührt?>\n<Farbe [#f0f] berührt [#f0f]?>\n(Entfernung von [ v])\nFrage [What's your name?] und warte\n(Antwort)\n<Taste [space v] gedrückt?>\n<Maustaste gedrückt?>\n(Maus x-Position)\n(Maus y-Position)\n(Lautstärke)\n(Video [motion v] auf [this sprite v])\nschalte Video [on v]\nsetze Video-Transparenz auf (50)%\n(Stoppuhr)\nsetze Stoppuhr zurück\n([x-Position v] von [Sprite1 v])\n([minute v] im Moment)\n(Tage seit 2000)\n(Benutzername)\n(user id)\n## Operators ##\n(() + ())\n(() - ())\n(() * ())\n(() / ())\n(Zufallszahl von (1) bis (10))\n<[] < []>\n<[] = []>\n<[] > []>\n<<> und <>>\n<<> oder <>>\n<nicht <>>\n(verbinde [hello ] [world])\n(Zeichen (1) von [world])\n(Länge von [world])\n(() mod ())\n(() gerundet)\n([Wurzel v] von (9))\n## Purple ##\nWenn [button pressed v] ## hat\n<Sensor [button pressed v]?>\n(Wert von Sensor [slider v])\nschalte Motor für (1) Sekunden an\nschalte Motor an\nschalte Motor aus\nsetze Motorkraft auf (100)\nsetze Motorrichtung auf [this way v]\nWenn Abstand < (20) ## hat\nWenn Neigung = (1) ## hat\n(Abstand)\n(Neigung)\n## Looks ##\nziehe Kostüm [costume1 v] an\nwechsle zum Hintergrund [background1 v]\nnächster Hintergrund\n(Hintergrund Nr.)\n## Control ##\nfalls <> ## cstart\nwiederhole fortlaufend falls <> ## cstart cap\nstoppe dieses Skript ## cap\nstoppe alles ## cap\n## Events ##\nWenn angeklickt ## hat\n## Sensing ##\n<laut?>\n## Purple ##\nschalte Motor an\nschalte Motor aus\nschalte Motor für (1) Sekunden an\nsetze Motorkraft auf (100)\nsetze Motorrichtung auf [this way v]\n";
scratchblocks2.blocks += "## Motion ##\navancer de (10) pas\ntourner de cw (15) degrés ## -turn-arrow\ntourner de right (15) degrés ## -turn-arrow\ntourner ccw (15) degrés ## -turn-arrow\ntourner de left (15) degrés ## -turn-arrow\npointer en direction (90 v)\npointer vers [ v]\naller à x: (0) y: (0)\naller à [mouse-pointer v]\nglisser en (1) secondes à x: (0) y: (0)\nremplacer x par (10)\nmettre x à (0)\nremplacer y par (10)\nmettre y à (0)\nrebondir si le bord est atteint\nset rotation style [left-right v]\n(position x)\n(position y)\n(direction)\n## Looks ##\ndire [Salut!] pendant (2) secondes\ndire [Salut!]\npenser à [Mmmh...] pour (2) secondes\npenser à[Mmmh...]\nmontrer\ncacher\nbasculer sur le costume [costume1 v]\ncostume suivant\nbasculer sur l'arrière-plan [backdrop1 v]\nmodifier l'effet [couleur v] par (25)\nmettre l'effet [couleur v] à (0)\nannuler les effets graphiques\nmodifier la taille par (10)\nmettre la taille à (100)%\nenvoyer au premier plan\ndéplacer de (1) plans arrière\n(costume n°)\n(arrière-plan n°)\n(taille)\n## Stage-specific\n## Looks ##\nbasculer sur l'arrière-plan [backdrop1 v] et attendre\narrière-plan suivant\n(arrière-plan n°)\n## Sound ##\njouer le son [meow v]\njouer le son [meow v] complètement\narrêter tous les sons\njouer tambour (48 v) pour (0.2) temps\nfaire une pause pour (0.2) temps\njouer note (60 v) pour (0.5) temps\nmettre l'instrument à (1 v)\nmodifier le volume par (-10)\nmettre le volume à (100)%\n(volume)\nmodifier le tempo par (20)\nmettre le tempt à (60) bpm\n(tempo)\n## Pen ##\neffacer tout\nestampiller\nabaisser le stylo\nrelever le stylo\nmettre la couleur du stylo à [#f0f]\nmodifier la couleur du stylo par (10)\nmettre la couleur du stylo à (0)\nmodifier l'intensité du stylo par (10)\nmettre l'intensité du stylo à (50)\nmodifier la taille du stylo par (1)\nmettre la tailler du stylo à (1)\n## Variables ##\nà [var v] attribuer [0]\nchanger [var v] par (1)\nafficher variable [var v]\ncacher variable [var v]\n## List ##\najouter [chose] à [liste v]\nsupprimer (1 v) de [liste v]\ninsérer [chose] à (1 v) de [liste v]\nreplacer (1 v) dans [list v] avec [chose]\n(élément (1 v) de [liste v])\n(longeur de [liste v])\n<[liste v] contient [chose]>\nafficher la liste [liste v]\ncacher la liste [liste v]\n## Events ##\nquand gf pressé ## hat -green-flag\nquand green flag pressé ## hat -green-flag\nquand flag pressé ## hat -green-flag\nquand [espace v] est pressé ## hat\nquand this sprite pressé ## hat\nwhen backdrop switches to [backdrop1 v] ## hat\nwhen [loudness v] > (10) ## hat\nquand je reçois [message1 v] ## hat\nenvoyer à tous [message1 v]\nenvoyer à tous [message1 v] et attendren## Control ##\nattendre (1) secondes\nrépéter (10) fois ## cstart cap\nrépéter indéfiniment ## cstart cap\nsi <> ## ifblock cstart\nsinon ## celse\nfin ## cend\nattendre jusqu'à <>\nrépéter jusquà <> ## cstart\narrêter [tout v] ## cap\nwhen I start as a clone ## hat\ncreate clone of [myself v]\ndelete this clone ## cap\n## Sensing ##\n<touché [ v]?>\n<couleur [#f0f] touchée?>\n<couleur[#f0f] touche [#0f0]?>\n(distance de [ v])\ndemander [Quel est votre nom?] and wait\n(réponse)\n<touche [espace v] pressée?>\n<souris pressée?>\n(souris x)\n(souris y)\n(volume sonore)\n(video [motion v] on [this sprite v])\nturn video [on v]\nset video transparency to (50)%\n(chronomètre)\nréinitialiser le chronomètre\n([position x v] de [Sprite1 v])\n(current [minute v])\n(days since 2000)\n(username)\n(user id)\n## Operators ##\n(() + ())\n(() - ())\n(() * ())\n(() / ())\n(nombre aléatoire entre (1) et (10))\n<[] < []>\n<[] = []>\n<[] > []>\n<<> et <>>\n<<> ou <>>\n<non <>>\n(regrouper [salut] [monde])\n(letter (1) de [monde])\n(longeur de [monde])\n(() mod ())\n(arrondir ())\n([racine v] de (9))\n## Purple ##\nwhen [button pressed v] ## hat\n<capteur [boutton pressé v] activé?>\n(valuer du capteur [potentiomètre v])\nturn motor on for (1) secs\nturn motor on\nturn motor off\nset motor power (100)\nset motor direction [this way v]\nwhen distance < (20) ## hat\nwhen tilt = (1) ## hat\n(distance)\n(tilt)\n## Looks ##\nbascluer sur le costume [costume1 v]\nbasculer sur l'arrière-plan [background1 v]\narrière-plan suivant\n(arrière-plan n°)\n## Control ##\nsi <> ## cstart\nrépéter jusqu'à <> ## cstart\narrêter le script ## cap\narrêter tout ## cap\n## Events ##\nquand pressé## hat\n## Sensing ##\n<son fort?>\n## Purple ##\nmotor on\nmotor off\nmotor on for (1) seconds\nmotor power (100)\nmotor direction [this way v]\n"
diacritics_removal_map = [{
	base: "A",
	letters: /[\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F]/g
}, {
	base: "AA",
	letters: /[\uA732]/g
}, {
	base: "AE",
	letters: /[\u00C6\u01FC\u01E2]/g
}, {
	base: "AO",
	letters: /[\uA734]/g
}, {
	base: "AU",
	letters: /[\uA736]/g
}, {
	base: "AV",
	letters: /[\uA738\uA73A]/g
}, {
	base: "AY",
	letters: /[\uA73C]/g
}, {
	base: "B",
	letters: /[\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181]/g
}, {
	base: "C",
	letters: /[\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E]/g
}, {
	base: "D",
	letters: /[\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779]/g
}, {
	base: "DZ",
	letters: /[\u01F1\u01C4]/g
}, {
	base: "Dz",
	letters: /[\u01F2\u01C5]/g
}, {
	base: "E",
	letters: /[\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E]/g
}, {
	base: "F",
	letters: /[\u0046\u24BB\uFF26\u1E1E\u0191\uA77B]/g
}, {
	base: "G",
	letters: /[\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E]/g
}, {
	base: "H",
	letters: /[\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D]/g
}, {
	base: "I",
	letters: /[\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197]/g
}, {
	base: "J",
	letters: /[\u004A\u24BF\uFF2A\u0134\u0248]/g
}, {
	base: "K",
	letters: /[\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2]/g
}, {
	base: "L",
	letters: /[\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780]/g
}, {
	base: "LJ",
	letters: /[\u01C7]/g
}, {
	base: "Lj",
	letters: /[\u01C8]/g
}, {
	base: "M",
	letters: /[\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C]/g
}, {
	base: "N",
	letters: /[\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4]/g
}, {
	base: "NJ",
	letters: /[\u01CA]/g
}, {
	base: "Nj",
	letters: /[\u01CB]/g
}, {
	base: "O",
	letters: /[\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C]/g
}, {
	base: "OI",
	letters: /[\u01A2]/g
}, {
	base: "OO",
	letters: /[\uA74E]/g
}, {
	base: "OU",
	letters: /[\u0222]/g
}, {
	base: "P",
	letters: /[\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754]/g
}, {
	base: "Q",
	letters: /[\u0051\u24C6\uFF31\uA756\uA758\u024A]/g
}, {
	base: "R",
	letters: /[\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782]/g
}, {
	base: "S",
	letters: /[\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784]/g
}, {
	base: "T",
	letters: /[\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786]/g
}, {
	base: "TZ",
	letters: /[\uA728]/g
}, {
	base: "U",
	letters: /[\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244]/g
}, {
	base: "V",
	letters: /[\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245]/g
}, {
	base: "VY",
	letters: /[\uA760]/g
}, {
	base: "W",
	letters: /[\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72]/g
}, {
	base: "X",
	letters: /[\u0058\u24CD\uFF38\u1E8A\u1E8C]/g
}, {
	base: "Y",
	letters: /[\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE]/g
}, {
	base: "Z",
	letters: /[\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762]/g
}, {
	base: "a",
	letters: /[\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250]/g
}, {
	base: "aa",
	letters: /[\uA733]/g
}, {
	base: "ae",
	letters: /[\u00E6\u01FD\u01E3]/g
}, {
	base: "ao",
	letters: /[\uA735]/g
}, {
	base: "au",
	letters: /[\uA737]/g
}, {
	base: "av",
	letters: /[\uA739\uA73B]/g
}, {
	base: "ay",
	letters: /[\uA73D]/g
}, {
	base: "b",
	letters: /[\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253]/g
}, {
	base: "c",
	letters: /[\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184]/g
}, {
	base: "d",
	letters: /[\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A]/g
}, {
	base: "dz",
	letters: /[\u01F3\u01C6]/g
}, {
	base: "e",
	letters: /[\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD]/g
}, {
	base: "f",
	letters: /[\u0066\u24D5\uFF46\u1E1F\u0192\uA77C]/g
}, {
	base: "g",
	letters: /[\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F]/g
}, {
	base: "h",
	letters: /[\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265]/g
}, {
	base: "hv",
	letters: /[\u0195]/g
}, {
	base: "i",
	letters: /[\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131]/g
}, {
	base: "j",
	letters: /[\u006A\u24D9\uFF4A\u0135\u01F0\u0249]/g
}, {
	base: "k",
	letters: /[\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3]/g
}, {
	base: "l",
	letters: /[\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747]/g
}, {
	base: "lj",
	letters: /[\u01C9]/g
}, {
	base: "m",
	letters: /[\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F]/g
}, {
	base: "n",
	letters: /[\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5]/g
}, {
	base: "nj",
	letters: /[\u01CC]/g
}, {
	base: "o",
	letters: /[\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275]/g
}, {
	base: "oi",
	letters: /[\u01A3]/g
}, {
	base: "ou",
	letters: /[\u0223]/g
}, {
	base: "oo",
	letters: /[\uA74F]/g
}, {
	base: "p",
	letters: /[\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755]/g
}, {
	base: "q",
	letters: /[\u0071\u24E0\uFF51\u024B\uA757\uA759]/g
}, {
	base: "r",
	letters: /[\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783]/g
}, {
	base: "s",
	letters: /[\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B]/g
}, {
	base: "t",
	letters: /[\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787]/g
}, {
	base: "tz",
	letters: /[\uA729]/g
}, {
	base: "u",
	letters: /[\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289]/g
}, {
	base: "v",
	letters: /[\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C]/g
}, {
	base: "vy",
	letters: /[\uA761]/g
}, {
	base: "w",
	letters: /[\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73]/g
}, {
	base: "x",
	letters: /[\u0078\u24E7\uFF58\u1E8B\u1E8D]/g
}, {
	base: "y",
	letters: /[\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF]/g
}, {
	base: "z",
	letters: /[\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763]/g
}];