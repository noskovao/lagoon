#!/bin/bash
skopeo copy --retry-times 5 --dest-tls-verify=false docker://${IMAGECACHE_REGISTRY}/${PULL_IMAGE} docker://${REGISTRY}/${PROJECT}/${ENVIRONMENT}/${IMAGE_NAME}:${IMAGE_TAG:-latest}
