<?php

require_once __DIR__ . '/wp-config.php';
require_once __DIR__ . '/wp-admin/includes/taxonomy.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

ob_end_flush();

error_reporting(E_ALL);

echo 'Init' . PHP_EOL;

echo 'Decoding posts json ' . PHP_EOL;
$data = json_decode(file_get_contents(__DIR__ . '/materias-all.json'), true);
$posts = &$data['posts'];

echo 'Total posts ' . count($posts) . PHP_EOL;
$categoryId = wp_create_category('Matérias');

if ($categoryId instanceof WP_Error) {
    die('Deu errado aí! Não consegui criar a categoria meu chapa!');
}

foreach ($posts as $post) {
    $postDate = preg_replace('/^Publicado em (\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}).*$/', '$3-$2-$1 $4:$5:00', $post['date']);

    preg_match('/\<img\s.*?src="(?<src>.*?)".*?\/?\>/', $post['content'], $matches);

    echo 'Post Date:' . $postDate . PHP_EOL;
    $featuredImageId = null;

    $featuredImageSrc = !empty($matches['src']) ? $matches['src'] : null;

    if (substr($featuredImageSrc, 0, 2) === '//') {
        $featuredImageSrc = 'http:' . $featuredImageSrc;
    }

    if ($featuredImageSrc) {
        echo 'Uploading Featured Image: ' . $featuredImageSrc . PHP_EOL;
        $featuredImageId = attachment_from_url($featuredImageSrc);
    }

    $wpPostData = [
        'post_title' => $post['title'],
        'post_content' => $post['content'],
        'post_status' => 'publish',
        'post_type' => 'post',
        'post_comments' => 'closed',
        'post_date' => $postDate,
        'ping_status' => 'closed',
        'post_category' => [$categoryId],
    ];

    if ($featuredImageId) {
        $wpPostData['post_content'] = str_replace(str_replace('http:', '', $featuredImageSrc), wp_get_attachment_url($featuredImageId), $wpPostData['post_content']);
    }

    echo 'Publicando...: ' . $wpPostData['post_title'] . PHP_EOL;
    $postId = wp_insert_post($wpPostData);

    if (!$postId instanceof WP_Error) {
        echo 'Publicado: ' . get_post_field('post_title', $postId) . PHP_EOL;

        if ($postId && $featuredImageId) {
            set_post_thumbnail($postId, $featuredImageId);
        }
    } else {
        echo 'Error: ' . PHP_EOL;
        print_r($postId->get_error_messages());
    }
}


/**
 * Insert an attachment from a URL address.
 *
 * @param  string   $url            The URL address.
 * @param  int|null $parent_post_id The parent post ID (Optional).
 * @return int|false                The attachment ID on success. False on failure.
 */
function attachment_from_url($url, $parent_post_id = null)
{
    $content = file_get_contents($url);

    if (!$content) {
        return false;
    }

    $upload = wp_upload_bits(basename($url), null, $content);
    if (!empty($upload['error'])) {
        return false;
    }

    $file_path = $upload['file'];
    $file_name = basename($file_path);
    $file_type = wp_check_filetype($file_name, null);
    $attachment_title = sanitize_file_name(pathinfo($file_name, PATHINFO_FILENAME));
    $wp_upload_dir = wp_upload_dir();

    $post_info = array(
        'guid' => $wp_upload_dir['url'] . '/' . $file_name,
        'post_mime_type' => $file_type['type'],
        'post_title' => $attachment_title,
        'post_content' => '',
        'post_status' => 'inherit',
    );

    // Create the attachment.
    $attach_id = wp_insert_attachment($post_info, $file_path, $parent_post_id);

    // Include image.php.

    // Generate the attachment metadata.
    $attach_data = wp_generate_attachment_metadata($attach_id, $file_path);

    // Assign metadata to attachment.
    wp_update_attachment_metadata($attach_id, $attach_data);

    return $attach_id;

}